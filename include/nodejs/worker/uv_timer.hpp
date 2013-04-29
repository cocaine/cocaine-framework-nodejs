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

#ifndef NODEJS_UV_TIMER_HPP
#define NODEJS_UV_TIMER_HPP

#include <uv.h>
#include "nodejs/worker/app_loop.hpp"

namespace worker {

class uv_timer {
public:
	uv_timer(io::app_loop& ioservice)
		: timer (new uv_timer_t) {
		uv_timer_init(ioservice.get_loop(), timer);
		timer->data = this;	
	}

	~uv_timer() {
		stop();
		delete timer;
	}

	void start(uint32_t timeout_sec, uint32_t repeat_sec) {
		uv_timer_start(timer
				, uv_timer::on_timer
				, (int64_t)(timeout_sec * 1000)
				, (int64_t)(repeat_sec * 1000));
	}

	void stop() {
		uv_timer_stop(timer);
	}

	template<class EventHandler>
	void set(EventHandler handler) {
		event_handler = handler;
	}

private:
	static void on_timer(uv_timer_t* hdl, int status) {
		uv_timer* timer_obj = (uv_timer*) hdl->data;
		timer_obj->event_handler(status);
	}

	uv_timer_t* timer;
	std::function<void(int )> event_handler;
};

} // namespace worker

#endif

