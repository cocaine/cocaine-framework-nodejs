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

#ifndef NODEJS_UV_EVENT_HPP
#define NODEJS_UV_EVENT_HPP

#include <uv.h>

namespace worker {

template<class Handler>
class UvEvent {
public:
	static void on_uv_event(uv_poll_t* req, int status, int event) {
		Handler* hdl = static_cast<Handler*>(req->data);
		hdl->on_event(req, status, event);
	}
};

} // namespace worker

#endif

