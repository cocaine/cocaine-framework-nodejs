/*
    Copyright (c) 2011-2013 Andrey Sibiryov <me@kobology.ru>
                             - original cocaine version
    Copyright (C) 2013-2013 Oleg Kutkov <olegkutkov@yandex-team.ru>
                             - port to nodejs libuv
    Copyright (c) 2011-2013 Other contributors as noted in the AUTHORS file.

    This file is part of Cocaine.

    Cocaine is free software; you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation; either version 3 of the License, or
    (at your option) any later version.

    Cocaine is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

#ifndef NODEJS_IO_READABLE_STREAM_HPP
#define NODEJS_IO_READABLE_STREAM_HPP

#include <cocaine/common.hpp>
#include <uv.h>
#include "nodejs/worker/app_loop.hpp"
#include "nodejs/worker/uv_event.hpp"

namespace worker { namespace io {

template<class Socket>
class readable_stream {
	COCAINE_DECLARE_NONCOPYABLE(readable_stream)

public:
	typedef Socket socket_type;
	typedef typename socket_type::endpoint_type endpoint_type;

	readable_stream(app_loop& loop, endpoint_type endpoint)
		: rr_socket(std::make_shared<socket_type>(endpoint))
		, socket_watcher(new uv_poll_t)
		, rd_offset(0)
		, rx_offset(0) {
		uv_poll_init(loop.get_loop(), socket_watcher, rr_socket->fd());
		socket_watcher->data = this;
		ring.resize(65536);
    	}

    	readable_stream(app_loop& loop, const std::shared_ptr<socket_type>& socket)
		: rr_socket(socket)
		, socket_watcher(new uv_poll_t)
		, rd_offset(0)
		, rx_offset(0) {
		uv_poll_init(loop.get_loop(), socket_watcher, rr_socket->fd());
		socket_watcher->data = this;
		ring.resize(65536);
	}

	~readable_stream() {
		delete socket_watcher;
	}

	template<class ReadHandler, class ErrorHandler>
	void bind(ReadHandler read_handler, ErrorHandler error_handler) {
		uv_poll_start(socket_watcher, UV_READABLE, UvEvent<readable_stream>::on_uv_event);
		handle_read = read_handler;
		handle_error = error_handler;
	}

	void unbind() {
		uv_poll_stop(socket_watcher);
		handle_read = nullptr;
		handle_error = nullptr;
	}

	void on_event(uv_poll_t* req, int status, int event) {
		while (ring.size() - rd_offset < 1024) {
			size_t unparsed = rd_offset - rx_offset;

			if (unparsed + 1024 > ring.size()) {
 				ring.resize(ring.size() << 1);
				continue;
			}

			// There's no space left at the end of the buffer, so copy all the unparsed
			// data to the beginning and continue filling it from there.
			std::memmove(
				ring.data(),
				ring.data() + rx_offset,
				unparsed
				);

			rd_offset = unparsed;
			rx_offset = 0;
		}

		// Keep the error code if the read() operation fails.
		std::error_code ec;

		// Try to read some data.
		ssize_t length = rr_socket->read(
						 ring.data() + rd_offset,
						 ring.size() - rd_offset,
						 ec
						);

		if (ec) {
			handle_error(ec);
			return;
		}



		if (length <= 0) {
			if (length == 0) {
				// NOTE: This means that the remote peer has closed the connection.
				uv_poll_stop(socket_watcher);
			}

			return;
		}

		rd_offset += length;

		size_t parsed = handle_read(
					ring.data() + rx_offset,
					rd_offset - rx_offset
				);

		rx_offset += parsed;
	}

private:
	// NOTE: Sockets can be shared among multiple queues, at least to be able
	// to write and read from two different queues.
	const std::shared_ptr<socket_type> rr_socket;

	// Socket poll object.
	uv_poll_t* socket_watcher;

	std::vector<char> ring;

	off_t rd_offset;
	off_t rx_offset;

	// Socket data callback.
	std::function<
		size_t(const char*, size_t)
	> handle_read;

	// Socket error callback.
	std::function<
		void(const std::error_code&)
	> handle_error;
};

}} // namespace worker::io

#endif

