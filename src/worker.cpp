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

#include <node_buffer.h>
#include "nodejs/worker/worker.hpp"

using namespace worker;
using namespace v8;

Persistent<String> node_worker::on_heartbeat_cb;
Persistent<String> node_worker::on_invoke_cb;
Persistent<String> node_worker::on_chunk_cb;
Persistent<String> node_worker::on_choke_cb;
Persistent<String> node_worker::on_error_cb;
Persistent<String> node_worker::on_terminate_cb;

void node_worker::Initialize(v8::Handle<v8::Object>& exports) {
	Handle<FunctionTemplate> tpl = FunctionTemplate::New(New);
	tpl->InstanceTemplate()->SetInternalFieldCount(1);

	NODE_SET_PROTOTYPE_METHOD(tpl, "send", node_worker::send);
	NODE_SET_PROTOTYPE_METHOD(tpl, "close", node_worker::close);
	exports->Set(String::NewSymbol("communicator"), tpl->GetFunction());

	on_heartbeat_cb = NODE_PSYMBOL("on_heartbeat");
	on_invoke_cb = NODE_PSYMBOL("on_invoke");
	on_chunk_cb = NODE_PSYMBOL("on_chunk");
	on_choke_cb = NODE_PSYMBOL("on_choke");
	on_error_cb = NODE_PSYMBOL("on_error");
	on_terminate_cb = NODE_PSYMBOL("on_terminate");
}

Handle<Value> node_worker::New(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() == 1) {
		if (!args[0]->IsString()) {
			return ThrowException(Exception::TypeError(String::New("argument should be a string (endpoint)")));
		}

		std::string endpoint = *(String::AsciiValue(args[0]));

		node_worker* worker_instance;

		try {
			worker_instance = new node_worker(endpoint);
		} catch (const std::exception& e) {
			return ThrowException(Exception::TypeError(String::New(e.what())));
		}

		worker_instance->Wrap(args.This());
		return args.This();
	}
	else if (args.Length() == 2) {
		if (!args[0]->IsString()) {
			return ThrowException(Exception::TypeError(String::New("first argument must be a string (host)")));
		}

		if (!args[1]->IsNumber()) {
			return ThrowException(Exception::TypeError(String::New("second argument must be an integer (port)")));
		}

		std::string host = *(String::AsciiValue(args[0]));
		uint16_t port = static_cast<uint16_t>(args[1]->Uint32Value());

		node_worker* worker_instance;

		try {
			worker_instance = new node_worker(host, port);
		} catch (const std::exception& e) {
			return ThrowException(Exception::TypeError(String::New(e.what())));
		}

		worker_instance->Wrap(args.This());
		return args.This();
	}

	return ThrowException(Exception::TypeError(String::New("invalid arguments (set endpoint or host:port)")));
}

node_worker::node_worker(const std::string& endpoint)
{
	typedef cocaine::io::local endpoint_t;

	auto socket = std::make_shared<cocaine::io::socket<endpoint_t>>(endpoint_t::endpoint(endpoint));
	channel.reset(new worker::io::channel<cocaine::io::socket<endpoint_t>>(io_loop, socket));
	install_handlers();
}

node_worker::node_worker(const std::string& host, const uint16_t port)
{
	typedef cocaine::io::tcp endpoint_t;

	auto socket = std::make_shared<cocaine::io::socket<endpoint_t>>(endpoint_t::endpoint(host, port));
	channel.reset(new worker::io::channel<cocaine::io::socket<endpoint_t>>(io_loop, socket));
	install_handlers();
}

node_worker::~node_worker() {
	channel->close();
}

void node_worker::install_handlers() {
	channel->bind_reader_cb(std::bind(&node_worker::on_message, this, std::placeholders::_1));
}

void node_worker::on_message(const cocaine::io::message_t& message)
{
	switch(message.id()) {
		case cocaine::io::event_traits<cocaine::io::rpc::heartbeat>::id: {
			on_heartbeat();
			break;
		}

		case cocaine::io::event_traits<cocaine::io::rpc::invoke>::id: {
			std::string event;
			message.as<cocaine::io::rpc::invoke>(event);
			on_invoke(message.band(), event);
			break;
		}

		case cocaine::io::event_traits<cocaine::io::rpc::chunk>::id: {
			std::string chunk;
			message.as<cocaine::io::rpc::chunk>(chunk);
			on_chunk(message.band(), chunk);
			break;
		}

		case cocaine::io::event_traits<cocaine::io::rpc::choke>::id: {
			on_choke(message.band());
			break;
		}

		case cocaine::io::event_traits<cocaine::io::rpc::error>::id: {
			cocaine::error_code ec;
			std::string error_message;
			message.as<cocaine::io::rpc::error>(ec, error_message);
			on_error(message.band(), ec, error_message);
			break;
		}

		case cocaine::io::event_traits<cocaine::io::rpc::terminate>::id: {
			on_terminate();
		}

		default: {
			on_error(message.band(), 42, "unknown message");
			break;
		}
	}
}

Handle<Value> node_worker::send(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 1 || !node::Buffer::HasInstance(args[0])) {
		return ThrowException(Exception::TypeError(String::New("one argument should be a buffer")));
	}

	Local<Object> buf = args[0]->ToObject();

	char* data = node::Buffer::Data(buf);
	size_t size = node::Buffer::Length(buf);

	node_worker* obj = ObjectWrap::Unwrap<node_worker>(args.This());

	try {
		obj->channel->write(data, size);
	} catch (const std::exception& e) {
		return ThrowException(Exception::TypeError(String::New(e.what())));
	}

	return scope.Close(args[0]);
}

Handle<Value> node_worker::close(const Arguments& args)
{
	HandleScope scope;
	node_worker* obj = ObjectWrap::Unwrap<node_worker>(args.This());

	try {
		obj->channel->close();
	} catch (const std::exception& e) {
		return ThrowException(Exception::TypeError(String::New(e.what())));
	}

	return Undefined();
}

void node_worker::on_heartbeat() {
	node::MakeCallback(handle_, on_heartbeat_cb, 0, NULL);
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

