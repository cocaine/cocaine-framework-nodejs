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

#include "nodejs/worker/service_resolver.hpp" 

using namespace worker;
using namespace services;
using namespace v8;

Persistent<String> service_resolver::resolve_cb;
Persistent<String> service_resolver::error_cb;

void service_resolver::Initialize(Handle<Object>& exports) {
	Handle<FunctionTemplate> tpl = FunctionTemplate::New(New);
	tpl->InstanceTemplate()->SetInternalFieldCount(1);

	NODE_SET_PROTOTYPE_METHOD(tpl, "ResolveByName", service_resolver::resolve);
	exports->Set(String::NewSymbol("ServiceResolver"), tpl->GetFunction());

	resolve_cb = NODE_PSYMBOL("on_resolve");
	error_cb = NODE_PSYMBOL("on_error");
}

Handle<Value> service_resolver::New(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2) {
		return ThrowException(Exception::TypeError(String::New("two arguments (host, port) is required")));
	}

	if (!args[0]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("first argument must be a string (host)")));
	}

	if (!args[1]->IsNumber()) {
		return ThrowException(Exception::TypeError(String::New("second argument must be an integer (port)")));
	}

	std::string host = *(String::AsciiValue(args[0]));
	unsigned int port = args[1]->Uint32Value();

	service_resolver* resolver_instance;

	try {
		resolver_instance = new service_resolver(host, port);
	} catch (const std::exception& e) {
		return ThrowException(Exception::TypeError(String::New("unable to create ServiceResolver")));
	}

	resolver_instance->Wrap(args.This());

	return args.This();
}

service_resolver::service_resolver(const std::string& host, const uint16_t port)
	: sid(0)
	, error_occured(false) {

	comm.reset(new io::cocaine_communicator<cocaine::io::tcp>
			 (ioservice, host, port));
	comm->on_chunk(std::bind(&service_resolver::on_chunk
				, this
				, std::placeholders::_1
				, std::placeholders::_2) );
	comm->on_choke(std::bind(&service_resolver::on_choke
				, this
				, std::placeholders::_1));

	comm->on_error(std::bind(&service_resolver::on_error
				, this
				, std::placeholders::_1
				, std::placeholders::_2
				, std::placeholders::_3));
}

Handle<Value> service_resolver::resolve(const v8::Arguments& args) {
	HandleScope scope;

	if (args.Length() != 1) {
		return ThrowException(Exception::TypeError(String::New("one argument (service name) is required")));
	}

	if (!args[0]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("first argument must be a string (service name)")));
	}

	std::string service_name = *(String::AsciiValue(args[0]));

	service_resolver* obj = ObjectWrap::Unwrap<service_resolver>(args.This());

	uint32_t sid_result = obj->resolve_by_name(service_name);

	return scope.Close(Integer::New(sid_result));
}

uint32_t service_resolver::resolve_by_name(const std::string name) {
	comm->send<cocaine::io::locator::resolve>(sid, name);
	return sid++;
}

void service_resolver::on_chunk(const uint64_t sid, const std::string& data) {
	msgpack::unpacked msg;
	msgpack::unpack(&msg, data.data(), data.size());
	cocaine::io::type_traits<result_type>::unpack(msg.get(), resolver_response);
}

void service_resolver::on_choke(const uint64_t sid) {
	HandleScope scope;

	if (!error_occured) {
		Local<Object> resp = Object::New();

		resp->Set(String::NewSymbol("sid"), Integer::New(static_cast<uint32_t>(sid)));

		std::pair<std::string, uint16_t> endpoint;
		std::tie(endpoint.first, endpoint.second) = std::get<0>(resolver_response);

		resp->Set(String::NewSymbol("host"), String::New(endpoint.first.c_str()));
		resp->Set(String::NewSymbol("port"), Integer::New(endpoint.second));	

		Local<Value> argv[1] = {
			resp
		};

		node::MakeCallback(handle_, resolve_cb, 1, argv);
	}

	error_occured = false;
}

void service_resolver::on_error(const uint64_t sid, const int code, const std::string& msg) {
	error_occured = true;

	HandleScope scope;

	Local<Value> argv[3] = {
		Integer::New(static_cast<uint32_t>(sid)),
		Integer::New(code),
		String::New(msg.c_str())
	};

	node::MakeCallback(handle_, error_cb, 3, argv);
}

