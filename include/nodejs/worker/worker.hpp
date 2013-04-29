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

#ifndef NODEJS_COCAINE_WORKER_HPP
#define NODEJS_COCAINE_WORKER_HPP

#include <node.h>
#include <boost/utility.hpp>
#include "nodejs/worker/io/cocaine_communicator.hpp"
#include "nodejs/worker/uv_timer.hpp"

namespace worker {

class node_worker 
	: private boost::noncopyable
	, public node::ObjectWrap {
public:
	static void Initialize(v8::Handle<v8::Object>& exports);

	node_worker(const std::string& endpoint, const std::string& uuid);

	static v8::Handle<v8::Value> send(const v8::Arguments& args);

private:
	static v8::Handle<v8::Value> New(const v8::Arguments& args);

	void on_heartbeat_timer(int status);
	void on_disown_timer(int status);

	void install_handlers();

	void on_heartbeat();
	void on_invoke(const uint64_t sid, const std::string& event);
	void on_chunk(const uint64_t sid, const std::string& data);
	void on_choke(const uint64_t sid);
	void on_error(const uint64_t sid, const int code, const std::string& msg);
	void on_terminate();

	std::string app_id;
	worker::io::app_loop io_loop;
	std::unique_ptr<worker::uv_timer> heartbeat_timer;
	std::unique_ptr<worker::uv_timer> disown_timer;
	std::unique_ptr<io::cocaine_communicator<cocaine::io::local>> worker_comm;

	static v8::Persistent<v8::String> on_invoke_cb;
	static v8::Persistent<v8::String> on_chunk_cb;
	static v8::Persistent<v8::String> on_choke_cb;
	static v8::Persistent<v8::String> on_error_cb;
	static v8::Persistent<v8::String> on_terminate_cb;
};

} //namespace worker

#endif

