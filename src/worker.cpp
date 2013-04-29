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

#include "nodejs/worker/worker.hpp"
#include <iostream>

using namespace worker;
using namespace v8;

Persistent<String> node_worker::on_invoke_cb;
Persistent<String> node_worker::on_chunk_cb;
Persistent<String> node_worker::on_choke_cb;
Persistent<String> node_worker::on_error_cb;
Persistent<String> node_worker::on_terminate_cb;

void node_worker::Initialize(v8::Handle<v8::Object>& exports) {
	Handle<FunctionTemplate> tpl = FunctionTemplate::New(New);
	tpl->InstanceTemplate()->SetInternalFieldCount(1);

	NODE_SET_PROTOTYPE_METHOD(tpl, "Send", node_worker::send);
	exports->Set(String::NewSymbol("Worker"), tpl->GetFunction());

	on_invoke_cb = NODE_PSYMBOL("on_invoke");
	on_chunk_cb = NODE_PSYMBOL("on_chunk");
	on_choke_cb = NODE_PSYMBOL("on_choke");
	on_error_cb = NODE_PSYMBOL("on_error");
	on_terminate_cb = NODE_PSYMBOL("on_terminate");
}

Handle<Value> node_worker::New(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2) {
		return ThrowException(Exception::TypeError(String::New("two arguments is required (endpoint, uuid)")));
	}

	if (!args[0]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("first argument should be a string (endpoint)")));
	}

	if (!args[1]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("second argument should be a string (uuid)")));
	}

	std::string endpoint = *(String::AsciiValue(args[0]));
	std::string uuid = *(String::AsciiValue(args[1]));

	node_worker* worker_instance;

	try {
		worker_instance = new node_worker(endpoint, uuid);
	} catch (const std::exception& e) {
		return ThrowException(Exception::TypeError(String::New("unable to create Worker")));
	}

	worker_instance->Wrap(args.This());

	return args.This();
}

node_worker::node_worker(const std::string& endpoint, const std::string& uuid)
	: app_id (uuid) {

	heartbeat_timer.reset(new worker::uv_timer(io_loop));
	disown_timer.reset(new worker::uv_timer(io_loop));

	worker_comm.reset(new io::cocaine_communicator<cocaine::io::local>(io_loop, endpoint));
	
	install_handlers();

	worker_comm->handshake(uuid);

	heartbeat_timer->set(std::bind(&node_worker::on_heartbeat_timer, this, std::placeholders::_1));

	heartbeat_timer->start(0u, 5u);

	disown_timer->set(std::bind(&node_worker::on_disown_timer, this, std::placeholders::_1));

	disown_timer->start(2u, 2u);
}

void node_worker::on_heartbeat_timer(int status) {
	worker_comm->heartbeat();
	disown_timer->start(2u, 2u);
}

void node_worker::on_disown_timer(int status) {
	heartbeat_timer->stop();
	on_error(0, 42, "worker has lost the controlling engine");
}

void node_worker::install_handlers() {
	worker_comm->on_heartbeat(std::bind(&node_worker::on_heartbeat, this));

	worker_comm->on_invoke(std::bind(&node_worker::on_invoke
						, this, std::placeholders::_1
						, std::placeholders::_2) );

	worker_comm->on_chunk(std::bind(&node_worker::on_chunk
						, this
						, std::placeholders::_1
						, std::placeholders::_2) );

	worker_comm->on_choke(std::bind(&node_worker::on_choke
						, this
						, std::placeholders::_1) );

	worker_comm->on_error(std::bind(&node_worker::on_error
						, this
						, std::placeholders::_1
						, std::placeholders::_2
						, std::placeholders::_3));

	worker_comm->on_terminate(std::bind(&node_worker::on_terminate, this));
}

Handle<Value> node_worker::send(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2) {
		return ThrowException(Exception::TypeError(String::New("two arguments is required (sid, data)")));
	}

	if (!args[0]->IsNumber()) {
		return ThrowException(Exception::TypeError(String::New("first argument must be an integer (sid)")));
	}

	if (!args[1]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("seconf argument must be a string (data)")));
	}

	uint32_t sid = args[0]->Uint32Value();
	std::string data = *(String::AsciiValue(args[1]));

	node_worker* obj = ObjectWrap::Unwrap<node_worker>(args.This());

	obj->worker_comm->send<cocaine::io::rpc::chunk>(sid, data);

	return scope.Close(args[0]);
}

void node_worker::on_heartbeat() {
	disown_timer->stop();
}

void node_worker::on_invoke(const uint64_t sid, const std::string& event) {
	Local<Value> argv[2] = {
		Integer::New(static_cast<uint32_t>(sid))
		, String::New(event.c_str())
	};

	node::MakeCallback(handle_, on_invoke_cb, 2, argv);
}

void node_worker::on_chunk(const uint64_t sid, const std::string& data) {
	Local<Value> argv[2] = {
		Integer::New(static_cast<uint32_t>(sid))
		, String::New(data.c_str())
	};

	node::MakeCallback(handle_, on_chunk_cb, 2, argv);
}

void node_worker::on_choke(const uint64_t sid) {
	Local<Value> argv[1] = {
		Integer::New(static_cast<uint32_t>(sid))
	};

	node::MakeCallback(handle_, on_choke_cb, 1, argv);
}

void node_worker::on_error(const uint64_t sid, const int code, const std::string& msg) {
	Local<Value> argv[3] = {
		Integer::New(static_cast<uint32_t>(sid))
		, Integer::New(code)
		, String::New(msg.c_str())
	};

	node::MakeCallback(handle_, on_error_cb, 3, argv);
}

void node_worker::on_terminate() {
	node::MakeCallback(handle_, on_terminate_cb, 0, NULL);
}

