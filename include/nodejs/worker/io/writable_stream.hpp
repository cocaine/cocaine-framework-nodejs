/*
    Copyright (c) 2011-2013 Andrey Sibiryov <me@kobology.ru>
                             - original cocaine version
    Copyright (C) 2013-2013 Oleg Kutkov <olegkutkov@yandex-team.ru>
                             - port to nodejs libuv
    Copyright (c) 2013-2013 Other contributors as noted in the AUTHORS file.

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

#ifndef NODEJS_IO_WRITABLE_STREAM_HPP
#define NODEJS_IO_WRITABLE_STREAM_HPP

#include <cstring>
#include <mutex>
#include <uv.h>
#include <cocaine/common.hpp>

namespace worker { namespace io {

template<class Socket>
class writable_stream {
	COCAINE_DECLARE_NONCOPYABLE(writable_stream)

public:
	typedef Socket socket_type;
	typedef typename socket_type::endpoint_type endpoint_type;

	writable_stream(const std::shared_ptr<socket_type>& socket)
		: wr_socket(socket)
		, tx_offset(0)
		, wr_offset(0) {

		std::cout << "make writable_stream" << std::endl;
		ring.resize(65536);
	}

	~writable_stream() {
		//pass
	}

	template<class ErrorHandler>
	void bind(ErrorHandler error_handler) {
		handle_error = error_handler;
	}

	void unbind() {
		handle_error = nullptr;
	}

	bool write(const char* data, size_t size) {
		std::unique_lock<std::mutex> m_lock(ring_mutex);

		if (tx_offset == wr_offset) {
			std::error_code ec;

			// Nothing is pending in the ring so try to write directly to the socket,
			// and enqueue only the remaining part, if any. Ignore any errors here.
			ssize_t sent = wr_socket->write(data, size, ec);

			if (sent >= 0) {
				if (static_cast<size_t>(sent) == size) {
					return false;
				}

				data += sent;
				size -= sent;
			}
		}

		while (ring.size() - wr_offset < size) {
			size_t unsent = wr_offset - tx_offset;

			if (unsent + size > ring.size()) {
				ring.resize(ring.size() << 1);
				continue;
			}

			// There's no space left at the end of the buffer, so copy all the unsent
			// data to the beginning and continue filling it from there.
			std::memmove(
				ring.data(),
				ring.data() + tx_offset,
				unsent
				);

			wr_offset = unsent;
			tx_offset = 0;
		}

		std::memcpy(ring.data() + wr_offset, data, size);

		wr_offset += size;

		return true;
	}

	bool on_event(int status) {
		if(status != 0){
			uv_err_t err = uv_last_error(uv_default_loop());
			handle_error(std::error_code(err.sys_errno_, std::system_category()));
			return false;
		} else {
			std::unique_lock<std::mutex> m_lock(ring_mutex);

			if (tx_offset == wr_offset) {
				return false;
			}

			// Keep the error code if the write() operation fails.
			std::error_code ec;

			// Try to send all the data at once.
			ssize_t sent = wr_socket->write(
				ring.data() + tx_offset,
				wr_offset - tx_offset,
				ec
				);

			if (ec) {
				handle_error(ec);
				return false;
			}

			if (sent > 0) {
				tx_offset += sent;
			}

			return true;

		}
	}

private:
	// NOTE: Sockets can be shared among multiple queues, at least to be able
	// to write and read from two different queues.
	const std::shared_ptr<socket_type> wr_socket;

	std::vector<char> ring;

	off_t tx_offset;
	off_t wr_offset;

	std::mutex ring_mutex;

	// Write error handler.
	std::function<
		void(const std::error_code&)
		> handle_error;
};

}} // namespace worker::io

#endif

