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

#include <cocaine/messages.hpp>
#include "nodejs/worker/service_storage.hpp"

#include <iostream>

using namespace worker;
using namespace services;
using namespace v8;

Persistent<String> service_storage::data_read_cb;
Persistent<String> service_storage::data_read_done_cb;
Persistent<String> service_storage::error_cb;

void service_storage::Initialize(Handle<Object>& exports) {
	Handle<FunctionTemplate> tpl = FunctionTemplate::New(New);
	tpl->InstanceTemplate()->SetInternalFieldCount(1);

	NODE_SET_PROTOTYPE_METHOD(tpl, "Read", service_storage::read);
	NODE_SET_PROTOTYPE_METHOD(tpl, "Write", service_storage::write);
	NODE_SET_PROTOTYPE_METHOD(tpl, "Remove", service_storage::remove);
	NODE_SET_PROTOTYPE_METHOD(tpl, "List", service_storage::list);

	exports->Set(String::NewSymbol("ServiceStorage"), tpl->GetFunction());

	data_read_cb = NODE_PSYMBOL("on_storage_read");
	data_read_done_cb = NODE_PSYMBOL("on_storage_read_done");
	error_cb = NODE_PSYMBOL("on_storage_error");
}

Handle<Value> service_storage::New(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2) {
		return ThrowException(Exception::TypeError(String::New("two arguments (host, port) is required")));
	}

	if (!args[0]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("first argument must be a string (host)")));
	}

	if (!args[1]->IsNumber()) {
		return ThrowException(Exception::TypeError(String::New("first argument must be an integer (port)")));
	}

	std::string host = *(String::AsciiValue(args[0]));
	unsigned int port = args[1]->Uint32Value();

	service_storage* storage_instance;

	try {
		storage_instance = new service_storage(host, port);
	} catch (const std::exception& e) {
		return ThrowException(Exception::TypeError(String::New("unable to create ServiceResolver")));
	}

	storage_instance->Wrap(args.This());

	return args.This();
}

service_storage::service_storage(const std::string& host, const uint16_t port)
	: sid(0)
	, error_occured(0) {

	comm.reset(new io::cocaine_communicator<cocaine::io::tcp>
			(ioservice, host, port));
	comm->on_chunk(std::bind(&service_storage::on_chunk
				, this
				, std::placeholders::_1
				, std::placeholders::_2) );
	comm->on_choke(std::bind(&service_storage::on_choke
				, this
				, std::placeholders::_1));
	comm->on_error(std::bind(&service_storage::on_error
				, this
				, std::placeholders::_1
				, std::placeholders::_2
				, std::placeholders::_3));
}

Handle<Value> service_storage::read(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2) {
		return ThrowException(Exception::TypeError(String::New("two argument (collection, key) is required")));
	}

	if (!args[0]->IsString() || !args[1]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("all arguments should be a string")));
	}

	std::string collection = *(String::AsciiValue(args[0]));
	std::string key = *(String::AsciiValue(args[1]));

	service_storage* obj = ObjectWrap::Unwrap<service_storage>(args.This());

	uint32_t sid_result = obj->execute_method<cocaine::io::storage::read>(collection, key);

	return scope.Close(Integer::New(sid_result));
}

Handle<Value> service_storage::write(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 3) {
		return ThrowException(Exception::TypeError(String::New("three argument (collection, key, value) is required")));
	}

	if (!args[0]->IsString() || !args[1]->IsString() || !args[2]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("all arguments should be a string")));
	}

	std::string collection = *(String::AsciiValue(args[0]));
	std::string key = *(String::AsciiValue(args[1]));
	std::string value = *(String::AsciiValue(args[2]));

	service_storage* obj = ObjectWrap::Unwrap<service_storage>(args.This());

	uint32_t sid_result = obj->execute_method<cocaine::io::storage::write>(collection, key, value);

	return scope.Close(Integer::New(sid_result));
}

Handle<Value> service_storage::remove(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2) {
		return ThrowException(Exception::TypeError(String::New("two argument (collection, key) is required")));
	}

	if (!args[0]->IsString() || !args[1]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("all arguments should be a string")));
	}

	std::string collection = *(String::AsciiValue(args[0]));
	std::string key = *(String::AsciiValue(args[1]));

	service_storage* obj = ObjectWrap::Unwrap<service_storage>(args.This());

	uint32_t sid_result = obj->execute_method<cocaine::io::storage::remove>(collection, key);

	return scope.Close(Integer::New(sid_result));
}

Handle<Value> service_storage::list(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 1) {
		return ThrowException(Exception::TypeError(String::New("two argument (collection) is required")));
	}

	if (!args[0]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("argument should be a string")));
	}

	std::string collection = *(String::AsciiValue(args[0]));

	service_storage* obj = ObjectWrap::Unwrap<service_storage>(args.This());

	uint32_t sid_result = obj->execute_method<cocaine::io::storage::list>(collection);

	return scope.Close(Integer::New(sid_result));
}

void service_storage::on_chunk(const uint64_t sid, const std::string& data) {
	msgpack::unpacked msg;
	msgpack::unpack(&msg, data.data(), data.size());

	typedef cocaine::io::event_traits<cocaine::io::storage::list>::result_type read_result;

	msg.get().as<read_result>();

	//TODO
}

void service_storage::on_choke(const uint64_t sid) {
	Local<Value> argv[1] = {
		Integer::New(static_cast<uint32_t>(sid))
	};

	node::MakeCallback(handle_, data_read_done_cb, 1, argv);
}

void service_storage::on_error(const uint64_t sid, const int code, const std::string& msg) {
	Local<Value> argv[3] = {
		Integer::New(static_cast<uint32_t>(sid))
		, Integer::New(code)
		, String::New(msg.c_str())
	};

	node::MakeCallback(handle_, error_cb, 3, argv);
}

