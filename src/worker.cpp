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

#include <errno.h>
#include <node_buffer.h>
#include <cocaine/traits.hpp>
#include <cocaine/traits/enum.hpp>
#include "nodejs/worker/worker.hpp"

using namespace worker;
using namespace v8;

Persistent<String> node_worker::on_heartbeat_cb;
Persistent<String> node_worker::on_invoke_cb;
Persistent<String> node_worker::on_chunk_cb;
Persistent<String> node_worker::on_choke_cb;
Persistent<String> node_worker::on_error_cb;
Persistent<String> node_worker::on_terminate_cb;
Persistent<String> node_worker::on_socket_error_cb;

namespace worker {
  static Handle<Value>
  unpack_http_request(const Arguments &args);  
}

void node_worker::Initialize(v8::Handle<v8::Object>& exports) {
	Handle<FunctionTemplate> tpl = FunctionTemplate::New(New);
	tpl->InstanceTemplate()->SetInternalFieldCount(1);

	NODE_SET_PROTOTYPE_METHOD(tpl, "send", node_worker::send);
	NODE_SET_PROTOTYPE_METHOD(tpl, "close", node_worker::close);
	NODE_SET_PROTOTYPE_METHOD(tpl, "unpackHttpRequest", unpack_http_request);
	NODE_SET_PROTOTYPE_METHOD(tpl, "sendTerminate", node_worker::send_terminate);
	exports->Set(String::NewSymbol("communicator"), tpl->GetFunction());

	on_heartbeat_cb = NODE_PSYMBOL("on_heartbeat");
	on_invoke_cb = NODE_PSYMBOL("on_invoke");
	on_chunk_cb = NODE_PSYMBOL("on_chunk");
	on_choke_cb = NODE_PSYMBOL("on_choke");
	on_error_cb = NODE_PSYMBOL("on_error");
	on_terminate_cb = NODE_PSYMBOL("on_terminate");
	on_socket_error_cb = NODE_PSYMBOL("on_socket_error");
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
			return ThrowException(Integer::New(errno));
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
			return ThrowException(Integer::New(errno));
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

	auto host1 = boost::asio::ip::address::from_string(host);

	auto socket = std::make_shared<cocaine::io::socket<endpoint_t>>(endpoint_t::endpoint(host1, port));
	channel.reset(new worker::io::channel<cocaine::io::socket<endpoint_t>>(io_loop, socket));
	install_handlers();
}

node_worker::~node_worker() {
	channel->close();
}

void node_worker::install_handlers() {
  channel->bind_reader_cb(
    std::bind(&node_worker::on_message, this, std::placeholders::_1),
    std::bind(&node_worker::on_socket_error, this, std::placeholders::_1));
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
			int error;
			std::string error_message;
			message.as<cocaine::io::rpc::error>(error, error_message);
			on_error(message.band(), error, error_message);
			break;
		}

		case cocaine::io::event_traits<cocaine::io::rpc::terminate>::id: {
			cocaine::io::rpc::terminate::code code;
			std::string reason;
			message.as<cocaine::io::rpc::terminate>(code, reason);
			on_terminate(message.band(), code, reason);
      break;
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

	return Undefined();
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

Handle<Value> node_worker::send_terminate(const Arguments& args)
{
	HandleScope scope;

	if (args.Length() != 3) {
		return ThrowException(Exception::TypeError(String::New("3 arguments is required")));
	}

	if (!args[0]->IsNumber()) {
		return ThrowException(Exception::TypeError(String::New("first argument must be an integer (session id)")));
	}

	if (!args[1]->IsNumber()) {
		return ThrowException(Exception::TypeError(String::New("second argument must be an integer (reason code)")));
	}

	if (!args[2]->IsString()) {
		return ThrowException(Exception::TypeError(String::New("third argument must be a string (reason message)")));
	}

	uint64_t sid = static_cast<uint64_t>(args[0]->Uint32Value());
	cocaine::io::rpc::terminate::code code = static_cast<cocaine::io::rpc::terminate::code>(args[1]->Uint32Value());
	std::string msg = *(String::AsciiValue(args[2]));

	node_worker* obj = ObjectWrap::Unwrap<node_worker>(args.This());

	try {
		obj->msg_write<cocaine::io::rpc::terminate>(sid, code, msg);
	} catch (const std::exception& e) {
		return ThrowException(Exception::TypeError(String::New(e.what())));
	}

	return scope.Close(args[0]);
}

template<class Event, typename... Args>
void node_worker::msg_write(uint64_t stream, Args&&... args)
{
	msgpack::sbuffer msgbuffer;
	msgpack::packer<msgpack::sbuffer> packer(msgbuffer);

	typedef cocaine::io::event_traits<Event> traits;
	packer.pack_array(3);
	packer.pack_uint32(traits::id);
	packer.pack_uint64(stream);

	cocaine::io::type_traits<typename traits::tuple_type>::pack(packer, std::forward<Args>(args)...);

	channel->write(msgbuffer.data(), msgbuffer.size());
}

void node_worker::on_heartbeat() {
	HandleScope scope;
	node::MakeCallback(handle_, on_heartbeat_cb, 0, NULL);
}

void node_worker::on_invoke(const uint64_t sid, const std::string& event) {
	HandleScope scope;
	Local<Value> argv[2] = {
		Integer::New(static_cast<uint32_t>(sid))
		, String::New(event.c_str())
	};

	node::MakeCallback(handle_, on_invoke_cb, 2, argv);
}

void node_worker::on_chunk(const uint64_t sid, const std::string& data) {
	HandleScope scope;

  node::Buffer *b = node::Buffer::New(const_cast<char*>(data.c_str()),data.size());
	Local<Value> argv[2] = {
		Integer::New(static_cast<uint32_t>(sid))
    , Local<Value>::New(b->handle_)
	};

	node::MakeCallback(handle_, on_chunk_cb, 2, argv);
}

void node_worker::on_choke(const uint64_t sid) {
	HandleScope scope;
	Local<Value> argv[1] = {
		Integer::New(static_cast<uint32_t>(sid))
	};

	node::MakeCallback(handle_, on_choke_cb, 1, argv);
}

void node_worker::on_error(const uint64_t sid, const int code, const std::string& msg) {
	HandleScope scope;
	Local<Value> argv[3] = {
		Integer::New(static_cast<uint32_t>(sid))
		, Integer::New(code)
		, String::New(msg.c_str())
	};

	node::MakeCallback(handle_, on_error_cb, 3, argv);
}

void node_worker::on_terminate(const uint64_t sid, const int code, const std::string& reason) {
	HandleScope scope;
	Local<Value> argv[3] = {
		Integer::New(static_cast<uint32_t>(sid))
		, Integer::New(code)
		, String::New(reason.c_str())
	};

	node::MakeCallback(handle_, on_terminate_cb, 3, argv);
}

void node_worker::on_socket_error(const std::error_code& ec){
  HandleScope scope;
  Local<Value> argv[1] = {
    Integer::New(ec.value())};
  node::MakeCallback(handle_, on_socket_error_cb, 1, argv);
}

namespace worker {

  class MsgpackException {
  public:
    MsgpackException(const char *str) :
      msg(String::New(str)) {
    }

    Handle<Value> getThrownException() {
      return Exception::TypeError(msg);
    }

  private:
    const Handle<String> msg;
  };

  class MsgpackZone {
  public:
    msgpack_zone _mz;

    MsgpackZone(size_t sz = 1024) {
      msgpack_zone_init(&this->_mz, sz);
    }

    ~MsgpackZone() {
      msgpack_zone_destroy(&this->_mz);
    }
  };

  class MsgpackSbuffer {
  public:
    msgpack_sbuffer _sbuf;

    MsgpackSbuffer() {
      msgpack_sbuffer_init(&this->_sbuf);
    }

    ~MsgpackSbuffer() {
      msgpack_sbuffer_destroy(&this->_sbuf);
    }
  };

// Convert a MessagePack object to a V8 object.
//
// This method is recursive. It will probably blow out the stack on objects
// with extremely deep nesting.
  static Handle<Value>
  msgpack_to_v8(msgpack_object *mo) {
    switch (mo->type) {
      case MSGPACK_OBJECT_NIL:
        return Null();

      case MSGPACK_OBJECT_BOOLEAN:
        return (mo->via.boolean) ?
          True() :
          False();

      case MSGPACK_OBJECT_POSITIVE_INTEGER:
        return Integer::NewFromUnsigned(static_cast<uint32_t>(mo->via.u64));

      case MSGPACK_OBJECT_NEGATIVE_INTEGER:
        return Integer::New(static_cast<int32_t>(mo->via.i64));

      case MSGPACK_OBJECT_DOUBLE:
        return Number::New(mo->via.dec);

      case MSGPACK_OBJECT_ARRAY: {
        Local<Array> a = Array::New(mo->via.array.size);

        for (uint32_t i = 0; i < mo->via.array.size; i++) {
          a->Set(i, msgpack_to_v8(&mo->via.array.ptr[i]));
        }

        return a;
      }

      case MSGPACK_OBJECT_RAW:
        return String::New(mo->via.raw.ptr, mo->via.raw.size);

      case MSGPACK_OBJECT_MAP: {
        Local<Object> o = Object::New();

        for (uint32_t i = 0; i < mo->via.map.size; i++) {
          o->Set(
            msgpack_to_v8(&mo->via.map.ptr[i].key),
            msgpack_to_v8(&mo->via.map.ptr[i].val)
            );
        }

        return o;
      }

      default:
        throw MsgpackException("Encountered unknown MesssagePack object type");
    }
  }

  static Handle<Value>
  msgpack_http_request_to_v8(msgpack_object *mo) {
    switch (mo->type) {

      case MSGPACK_OBJECT_MAP: {
        Local<Object> o = Object::New();

        for (uint32_t i = 0; i < mo->via.map.size; i++) {
          msgpack_object *key = &mo->via.map.ptr[i].key;
          msgpack_object *val = &mo->via.map.ptr[i].val;
          if(key->type == MSGPACK_OBJECT_RAW
             && key->via.raw.size == 4
             && val->type == MSGPACK_OBJECT_RAW){
            const char *k = key->via.raw.ptr;
            if(k[0]=='b'&&k[1]=='o'&&k[2]=='d'&&k[3]=='y'){
              node::Buffer *b = node::Buffer::New(const_cast<char*>(val->via.raw.ptr),
                                      val->via.raw.size);
              o->Set(String::New("body"),
                     Local<Object>::New(b->handle_));
              continue;}}
          o->Set(
            msgpack_to_v8(&mo->via.map.ptr[i].key),
            msgpack_to_v8(&mo->via.map.ptr[i].val));
        }

        return o;
      }

      default:
        throw MsgpackException("http request is not a map");
    }
  }


  static Handle<Value>
  unpack_http_request(const Arguments &args) {
    static Persistent<String> msgpack_bytes_remaining_symbol =
      NODE_PSYMBOL("bytes_remaining");

    HandleScope scope;

    if (args.Length() < 0 || !node::Buffer::HasInstance(args[0])) {
      return ThrowException(Exception::TypeError(
                              String::New("First argument must be a Buffer")));
    }

    Local<Object> buf = args[0]->ToObject();

    MsgpackZone mz;
    msgpack_object mo;
    size_t off = 0;

    switch (msgpack_unpack(node::Buffer::Data(buf), node::Buffer::Length(buf), &off, &mz._mz, &mo)) {
      case MSGPACK_UNPACK_EXTRA_BYTES:
      case MSGPACK_UNPACK_SUCCESS:
        try {
          // msgpack_unpack_template->GetFunction()->Set(
          //   msgpack_bytes_remaining_symbol,
          //   Integer::New(static_cast<int32_t>(Buffer::Length(buf) - off))
          //   );
          return scope.Close(msgpack_http_request_to_v8(&mo));
        } catch (MsgpackException e) {
          return ThrowException(e.getThrownException());
        }

      case MSGPACK_UNPACK_CONTINUE:
        return scope.Close(Undefined());

      default:
        return ThrowException(Exception::Error(
                                String::New("Error de-serializing object")));
    }
  }
}

