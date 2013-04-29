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

#include <cocaine/rpc/decoder.hpp>
#include <cocaine/rpc/encoder.hpp>
#include "readable_stream.hpp"
#include "writable_stream.hpp"

namespace worker { namespace io {

template<class Socket>
class channel {
public:
	channel(app_loop& loop, const std::shared_ptr<Socket>& socket)
		: rd(new cocaine::io::decoder<readable_stream<Socket>>())
		, wr(new cocaine::io::encoder<writable_stream<Socket>>()) {
		rd->attach(std::make_shared<readable_stream<Socket>>(loop, socket));
		wr->attach(std::make_shared<writable_stream<Socket>>(loop, socket));
	}

	std::unique_ptr<cocaine::io::decoder<readable_stream<Socket>>> rd;
	std::unique_ptr<cocaine::io::encoder<writable_stream<Socket>>> wr;
};

}}

#endif // namespace worker::io

