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

#ifndef NODEJS_COCAINE_IO_CHANNEL_INTERFACE_HPP
#define NODEJS_COCAINE_IO_CHANNEL_INTERFACE_HPP

#include <cocaine/messages.hpp>

namespace worker { namespace io {

class channel_interface {
public:
	~channel_interface() {
	}

	typedef std::function<void(const cocaine::io::message_t& message)> rd_func;
	typedef std::function<void(const std::error_code& code)> err_func;

	virtual void bind_cb(rd_func, err_func) =0;
	virtual void write(const char* data, const size_t size) =0;
	virtual void close() =0;
};

}}

#endif

