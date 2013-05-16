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
#include <cocaine/asio/local.hpp>
#include <cocaine/asio/tcp.hpp>
#include <cocaine/asio/socket.hpp>
#include "nodejs/worker/app_loop.hpp"
#include "nodejs/worker/io/channel.hpp"

namespace worker {

class node_worker 
	: public node::ObjectWrap {

	COCAINE_DECLARE_NONCOPYABLE(node_worker)

public:
	static void Initialize(v8::Handle<v8::Object>& exports);

	node_worker(const std::string& endpoint);
	node_worker(const std::string& host, const uint16_t port);
	~node_worker();

	static v8::Handle<v8::Value> send(const v8::Arguments& args);
	static v8::Handle<v8::Value> close(const v8::Arguments& args);

private:
	static v8::Handle<v8::Value> New(const v8::Arguments& args);

	void install_handlers();

	void on_message(const cocaine::io::message_t& message);

	void on_heartbeat();
	void on_invoke(const uint64_t sid, const std::string& event);
	void on_chunk(const uint64_t sid, const std::string& data);
	void on_choke(const uint64_t sid);
	void on_error(const uint64_t sid, const int code, const std::string& msg);
	void on_terminate(const uint64_t sid, const int code, const std::string& reason);

	worker::io::app_loop io_loop;
	std::unique_ptr<worker::io::channel_interface> channel;

	static v8::Persistent<v8::String> on_heartbeat_cb;
	static v8::Persistent<v8::String> on_invoke_cb;
	static v8::Persistent<v8::String> on_chunk_cb;
	static v8::Persistent<v8::String> on_choke_cb;
	static v8::Persistent<v8::String> on_error_cb;
	static v8::Persistent<v8::String> on_terminate_cb;
};

} //namespace worker

#endif

