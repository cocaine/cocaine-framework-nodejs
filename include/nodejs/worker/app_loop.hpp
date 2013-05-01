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

#ifndef NODEJS_APP_LOOP_HPP
#define NODEJS_APP_LOOP_HPP

#include <cocaine/common.hpp>
#include <uv.h>

namespace worker { namespace io {

class app_loop {
	COCAINE_DECLARE_NONCOPYABLE(app_loop)
public:
	app_loop()
		: loop(uv_default_loop()) { }

	uv_loop_t* get_loop() {
		return loop;
	}

private:
	uv_loop_t* loop;
};

}} // namespace worker::io

#endif

