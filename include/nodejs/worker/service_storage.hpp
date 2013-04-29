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

#ifndef NODEJS_COCAINE_SERVICE_STORAGE_HPP
#define NODEJS_COCAINE_SERVICE_STORAGE_HPP

#include <node.h>
#include "nodejs/worker/io/cocaine_communicator.hpp"

namespace worker { namespace services {

class service_storage
	: public node::ObjectWrap {
public:
	static void Initialize(v8::Handle<v8::Object>& exports);

	service_storage(const std::string& host, const uint16_t port);

	static v8::Handle<v8::Value> read(const v8::Arguments& args);
	static v8::Handle<v8::Value> write(const v8::Arguments& args);
	static v8::Handle<v8::Value> remove(const v8::Arguments& args);
	static v8::Handle<v8::Value> list(const v8::Arguments& args);

private:
	static v8::Handle<v8::Value> New(const v8::Arguments& args);

	void on_chunk(const uint64_t sid, const std::string& data);
	void on_choke(const uint64_t sid);
	void on_error(const uint64_t sid, const int code, const std::string& msg);

	template<class Event, typename... Args>
	uint32_t execute_method(Args&&... args) {
		comm->send<Event>(sid, args...);
		return sid++;
	}

	uint32_t sid;
	bool error_occured;
	worker::io::app_loop ioservice;
	std::unique_ptr<io::cocaine_communicator<cocaine::io::tcp>> comm;

	static v8::Persistent<v8::String> data_read_cb;
	static v8::Persistent<v8::String> data_read_done_cb;
	static v8::Persistent<v8::String> error_cb;
};

}} // namespace worker::service

#endif

