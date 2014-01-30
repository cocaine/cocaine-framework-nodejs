/*
    Copyright (c) 2013-2013 Oleg Kutkov <olegkutkov@yandex-team.ru>
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

#ifndef NODEJS_COCAINE_IO_CHANNEL_HPP
#define NODEJS_COCAINE_IO_CHANNEL_HPP

#include <uv.h>
#include <cocaine/rpc/decoder.hpp>
#include "readable_stream.hpp"
#include "writable_stream.hpp"
#include "nodejs/worker/io/channel_interface.hpp"
#include "nodejs/worker/error_handler.hpp"

namespace worker { namespace io {

template<class Socket>
class channel
	: public channel_interface {

public:
	channel(app_loop &loop, const std::shared_ptr<Socket> &_socket)
		: active_events(0)
		, socket(_socket)
		, watcher(new uv_poll_t)
		, rd_stream(std::make_shared<readable_stream<Socket>>(socket))
		, rd(new cocaine::io::decoder<readable_stream<Socket>>())
		, wr(new writable_stream<Socket>(socket))
		, stamp(12345) {

		rd->attach(rd_stream);
		uv_poll_init(loop.get_loop(), watcher.get(), _socket->fd());
		watcher->data = this;
	}

	void bind_cb(rd_func func, err_func err) {
		if(active_events != 0) {
			throw std::runtime_error(cocaine::format("bind with active_events %d", active_events));
		}
		active_events = UV_READABLE;
		uv_poll_start(watcher.get(), active_events, channel<Socket>::uv_on_event); 
		rd->bind(func, err);
		wr->bind(err);
	}

	void close() {
		if(active_events){
			active_events = 0;
			uv_poll_stop(watcher.get());
		}
		rd->unbind();
		wr->unbind();
	}

	void write(const char* data, const size_t size) {
		bool continue_writing = wr->write(data, size);
		if(continue_writing && !(active_events & UV_WRITABLE)){
			active_events |= UV_WRITABLE;

			uv_poll_start(watcher.get(), active_events, channel<Socket>::uv_on_event);
		}
	}

	static
	void uv_on_event(uv_poll_t *req, int status, int event){
		channel<Socket> *self = static_cast<channel<Socket>*>(req->data);

		if(status != 0){
			uv_err_t err = uv_last_error(uv_default_loop());
			std::error_code ec(err.sys_errno_, std::system_category());
			
			if(self->active_events & UV_READABLE){
				self->rd_stream->on_event(status);
			}
			if(self->active_events & UV_WRITABLE){
				self->wr->on_event(status);
			}
			// uv_poll_stop(watcher.get()); // not actually needed
			return;
		}
		
		if(self->active_events & event & UV_READABLE){
			bool reading = self->rd_stream->on_event(status);
			if(!reading){
				self->active_events &= ~UV_READABLE;
				uv_poll_start(req, self->active_events, channel<Socket>::uv_on_event);
			}
		} 

		if(self->active_events & event & UV_WRITABLE){
			bool writing = self->wr->on_event(status);
			if(!writing){
				self->active_events &= ~UV_WRITABLE;
				uv_poll_start(req, self->active_events, channel::uv_on_event);
			}
		}
	}

private:

	int active_events;
	const std::shared_ptr<Socket> socket;
	std::shared_ptr<uv_poll_t> watcher;

	std::shared_ptr<readable_stream<Socket>> rd_stream;
	std::unique_ptr<cocaine::io::decoder<readable_stream<Socket>>> rd;
	std::unique_ptr<writable_stream<Socket>> wr;

	int stamp;
};

}}	// namespace worker::io

#endif

