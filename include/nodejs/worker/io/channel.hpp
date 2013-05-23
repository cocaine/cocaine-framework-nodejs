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
#include "readable_stream.hpp"
#include "writable_stream.hpp"
#include "nodejs/worker/io/channel_interface.hpp"
#include "nodejs/worker/error_handler.hpp"

namespace worker { namespace io {

template<class Socket>
class channel
	: public channel_interface {

public:
	channel(app_loop& loop, const std::shared_ptr<Socket>& socket)
		: rd(new cocaine::io::decoder<readable_stream<Socket>>())
		, wr(new writable_stream<Socket>(loop, socket)) {

		rd->attach(std::make_shared<readable_stream<Socket>>(loop, socket));
		wr->bind(error_handler());
	}

	void bind_reader_cb(rd_func func) {
		rd->bind(func, error_handler());
	}

	void close() {
		rd->unbind();
		wr->unbind();
	}

	void write(const char* data, const size_t size) {
		wr->write(data, size);
	}

private:
	std::unique_ptr<cocaine::io::decoder<readable_stream<Socket>>> rd;
	std::unique_ptr<writable_stream<Socket>> wr;
};

}}

#endif // namespace worker::io

