
#include "common.hpp"
#include "stream.hpp"
#include "worker.hpp"


#include <v8.h>
#include <node.h>
#include <node_buffer.h>
#include <msgpack.h>
#include <math.h>
#include <vector>


namespace cocaine { namespace engine {


    Persistent<FunctionTemplate> stream_constructor;
    Persistent<FunctionTemplate> worker_constructor;

    Persistent<String> onread_sym;
    Persistent<String> oncomplete_sym;
    Persistent<String> errno_sym;
    Persistent<String> buffer_sym;
    Persistent<String> domain_sym;
    Persistent<String> process_sym;
    Persistent<String> bytes_sym;
    Persistent<String> write_queue_size_sym;
    Persistent<String> onconnection_sym;
    Persistent<String> heartbeat_sym;
    Persistent<String> onshutdown_sym;
    Persistent<String> onheartbeat_sym;

    void SetErrno(uv_err_t err) {
      HandleScope scope;
      if (errno_sym.IsEmpty()) {
        errno_sym = NODE_PSYMBOL("errno");
      }
      if (err.code == UV_UNKNOWN) {
        char errno_buf[100];
        snprintf(errno_buf, 100, "Unknown system errno %d", err.sys_errno_);
        Context::GetCurrent()->Global()->Set(errno_sym, String::New(errno_buf));
      } else {
        Context::GetCurrent()->Global()->Set(errno_sym,
                                             String::NewSymbol(uv_err_name(err)));
      }
    }

    static Persistent<FunctionTemplate> msgpack_unpack_template;

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
               && key->via.raw.size == 7
               && val->type == MSGPACK_OBJECT_RAW){
              const char *k = key->via.raw.ptr;
              if(k[0]=='r'&&k[1]=='e'&&k[2]=='q'&&k[3]=='u'
                 &&k[4]=='e'&&k[5]=='s'&&k[6]=='t'){
                Buffer *b = Buffer::New(const_cast<char*>(val->via.raw.ptr),
                                        val->via.raw.size);
                o->Set(String::New("request"),
                       Local<Object>::New(b->handle_));
                continue;}}
            o->Set(
              msgpack_to_v8(&mo->via.map.ptr[i].key),
              msgpack_to_v8(&mo->via.map.ptr[i].val)
              );
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

      if (args.Length() < 0 || !Buffer::HasInstance(args[0])) {
        return ThrowException(Exception::TypeError(
                                String::New("First argument must be a Buffer")));
      }

      Local<Object> buf = args[0]->ToObject();

      MsgpackZone mz;
      msgpack_object mo;
      size_t off = 0;

      switch (msgpack_unpack(Buffer::Data(buf), Buffer::Length(buf), &off, &mz._mz, &mo)) {
        case MSGPACK_UNPACK_EXTRA_BYTES:
        case MSGPACK_UNPACK_SUCCESS:
          try {
            msgpack_unpack_template->GetFunction()->Set(
              msgpack_bytes_remaining_symbol,
              Integer::New(static_cast<int32_t>(Buffer::Length(buf) - off))
              );
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
    
    
    void NodeWorkerInitialize(Handle<Object> target) {

      ::freopen("/tmp/cocaine.log","a",stdout);
      ::freopen("/tmp/cocaine.log","a",stderr);

      Stream::Initialize(target);
      NodeWorker::Initialize(target);

      msgpack_unpack_template = Persistent<FunctionTemplate>::New(
        FunctionTemplate::New(unpack_http_request));
      target->Set(
        String::NewSymbol("unpackHttpRequest"),
        msgpack_unpack_template->GetFunction());

    }
  }

} // namespace cocaine::engine


NODE_MODULE(cocaine, cocaine::engine::NodeWorkerInitialize);

