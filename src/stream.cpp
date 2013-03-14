
#include "common.hpp"
#include "req.hpp"
#include "stream.hpp"
#include "worker.hpp"

namespace cocaine { namespace engine {
    
    //==== js->c api ====

    Handle<Value>
    Stream::WriteBuffer(const Arguments &args){
      Stream *s=ObjectWrap::Unwrap<Stream>(args.This());
      HandleScope scope;
      int argc = args.Length();
      if(!(argc==1 && Buffer::HasInstance(args[0]))){
        return ThrowException(
          Exception::TypeError(
            String::New("arg[0] has to be a Buffer")));}
      switch(s->m_state){
        case st::reading:
          s->m_state = st::duplex;
          break;
        case st::read_ended:
          s->m_state = st::writing;
          break;
        case st::duplex:
        case st::writing:
          break;
        case st::shutdown:
          return ThrowException(
            String::New("write on shutdown stream"));
        case st::closed:
          return ThrowException(
            String::New("write on closed stream"));
      }
      Local<Object> buf = args[0]->ToObject();
      WriteReq *w = s->make_write_req(buf);
      s->m_write_queue_size += w->length;
      s->UpdateWriteQueueSize();
      ngx_queue_insert_tail(&(s->m_req_q),
                            &(w->m_req_q));
      s->set_want_write(true);
      return scope.Close(w->object_);
    }

    Handle<Value>
    Stream::Shutdown(const Arguments &args){
      HandleScope scope;
      Stream *s=ObjectWrap::Unwrap<Stream>(args.This());
      switch(s->m_state){
        case st::reading:
        case st::read_ended:
          s->m_state = st::shutdown;
          s->m_shutdown_req = s->make_shutdown_req();
          s->m_worker->pending_enq(s);
          return scope.Close(s->m_shutdown_req->object_);
        case st::duplex:
        case st::writing:
          s->m_state = st::shutdown;
          // this will cause all future writes to be
          // ignored and m_shutdown_req to be resolved
          // when there's no more pending writes left
          s->m_shutdown_req = s->make_shutdown_req();
          return scope.Close(s->m_shutdown_req->object_);
        case st::shutdown:
          return ThrowException(
            String::New("shutdown on shutdown stream"));
        case st::closed:
          return ThrowException(
            String::New("shutdown on closed stream"));
        default:
          ;
      }
    }

    Handle<Value>
    Stream::Close(const Arguments &args){
      Stream *s=ObjectWrap::Unwrap<Stream>(args.This());
      if((int)s->m_state < (int)st::closed){
        s->m_state = st::closed;
        //m_worker->writing_deq(this); // not. we'd rather
        //   check stream state after each callback in
        //   on_try_write or on_data instead
        s->m_worker->pending_enq(s);
      }
      return Undefined();
    }

    //==== js completion helpers ====

    void
    Stream::UpdateWriteQueueSize(){
      handle_->Set(write_queue_size_sym,Integer::New(m_write_queue_size));
    }

    void
    Stream::OnWrite(WriteReq *w){
      m_write_queue_size -= w->length;
      UpdateWriteQueueSize();
      w->on_complete();
    }

    void
    Stream::AfterShutdown(){
      if(m_shutdown_req){
        m_shutdown_req->on_complete();
        delete m_shutdown_req;
        m_shutdown_req = NULL;
      }
      m_state = st::closed;
      OnClose();
    }


    void
    Stream::OnClose(){
      cancel_and_destroy_reqs();
      m_worker->stream_remove(this);
    }

    void
    Stream::OnRead(Buffer *b){
      HandleScope scope;
      if(b){
        Local<Value> args[1]={
          Local<Value>::New(b->handle_)};
        MakeCallback(handle_,onread_sym,1,args);
      } else {
        //XXX SetErrno(UV_EOF);
        MakeCallback(handle_,onread_sym,0,NULL);
      }
    }

    //================

    Stream::Stream(const uint64_t &id,
                   NodeWorker *const worker):
      m_id(id),
      m_worker(worker),
      m_state(st::reading)
    {
      ngx_queue_init(&m_req_q);
    }

    Stream::~Stream(){
      assert(m_state == st::closed);
    }

    Handle<Value>
    Stream::New(const Arguments &args){
      if(!args.IsConstructCall()){
        return FromConstructorTemplate(stream_constructor,args);
      }
      return args.This();
    }
      
    Stream*
    Stream::New(const uint64_t& id,
                NodeWorker *worker){
      Stream *s = new Stream(id,worker);
      s->Wrap(stream_constructor->GetFunction()->NewInstance(0,NULL));
      return s;
    }

    void
    Stream::Initialize(Handle<Object> target){
      stream_constructor = Persistent<FunctionTemplate>::New(
        FunctionTemplate::New(New));
      stream_constructor->InstanceTemplate()->SetInternalFieldCount(1);
      NODE_SET_PROTOTYPE_METHOD(stream_constructor, "writeBuffer", WriteBuffer);
      NODE_SET_PROTOTYPE_METHOD(stream_constructor, "shutdown", Shutdown);
      NODE_SET_PROTOTYPE_METHOD(stream_constructor, "close", Close);
      target->Set(String::NewSymbol("Stream"),stream_constructor->GetFunction());
      onread_sym = NODE_PSYMBOL("onread");
    }

    //==== loop callbacks ====
    
    // called from Worker::on_shutdown
    void
    Stream::on_shutdown(){
      switch(m_state){
        case st::reading:
          m_state = st::closed;
          OnClose();
          break;
        case st::read_ended:
          m_state = st::writing;
          break;
        case st::duplex:
          m_state = st::writing;
          break;
        case st::writing:
          break;
        case st::shutdown:
          break;
        case st::closed:
          break;
      }
    }

    // called from Worker::on_stop
    void
    Stream::on_stop(){
      if(m_state != st::closed){
        m_state = st::closed;
        OnClose();
      }
    }
      
    // called from Worker::on_prepare
    bool
    Stream::on_prepare(){
      if(m_state == st::closed){
        OnClose();
      }
      if(m_state == st::shutdown){
        if(ngx_queue_empty(&m_req_q)){
          AfterShutdown();
        }
      }
      return true;
    }
      
    bool
    Stream::on_try_write1(){
      if((int)m_state < (int)st::closed){
        assert(m_want_write
               && !(ngx_queue_empty(&m_req_q)));
        ngx_queue_t *q = ngx_queue_head(&m_req_q);
        WriteReq *w = ngx_queue_data(&m_req_q,
                                     WriteReq,
                                     m_req_q);
        bool r=m_worker->send_raw(w->msg); // can throw
        if(r){
          ngx_queue_remove(q);
          OnWrite(w);
          delete w;
          if(ngx_queue_empty(&m_req_q)){
            set_want_write(false);
          }
        }
        return r;
      } else {
        return false;
      }
    }

    void
    Stream::on_data(char *data, size_t size){
      switch(m_state){
        case st::reading:
        case st::duplex:
          break;
        case st::read_ended:
        case st::writing:
        case st::shutdown:
        case st::closed:
          // drop or throw
          return;
      }
      Buffer *b=Buffer::New(const_cast<char*>(data),size); //make some heat
      OnRead(b);
    }

    void
    Stream::on_end(){
      switch(m_state){
        case st::reading:
          m_state = st::read_ended;
          break;
        case st::read_ended:
          //throw
          break;
        case st::duplex:
          m_state = st::writing;
          break;
        case st::writing:
        case st::shutdown:
        case st::closed:
          //drop incoming message
          return;
      }
      OnRead(NULL);
    }

    void
    Stream::on_error(error_code code,
                     const std::string& message){
      if(m_state != st::closed){
        m_state = st::closed;
        send<rpc::error>(static_cast<int>(code), message);
        send<rpc::choke>();
        OnClose();
      }
    }

    //================

    std::shared_ptr<Stream::Shared>
    Stream::MakeShared(const uint64_t& id,
                       NodeWorker *worker){
      return std::make_shared<Stream::Shared>(
        Stream::New(id,worker));
    }

    void
    Stream::set_want_write(bool want){
      if(want && !m_want_write){
        assert(m_state != st::shutdown && m_state != st::closed);
        m_want_write = want;
        m_worker->writing_enq(this);
      } else if(!want && m_want_write){
        m_want_write = want;
        m_worker->writing_deq(this);
        if(m_state == st::shutdown){
          AfterShutdown();
        }
      }
    }

    void
    Stream::cancel_and_destroy_reqs(){
      ngx_queue_t* q = NULL;
      while(!ngx_queue_empty(&m_req_q)){
        q = ngx_queue_head(&m_req_q);
        ngx_queue_remove(q);
        WriteReq *w = ngx_queue_data(q,WriteReq,m_req_q);
        assert(w->stream == this);
        w->on_cancel();
        delete w;
      }
      if(m_shutdown_req){
        m_shutdown_req->on_cancel();
        delete m_shutdown_req;
        m_shutdown_req = NULL;
      }
    }

    WriteReq*
    Stream::make_write_req(Handle<Object> buf){
      WriteReq *req = new WriteReq(this,buf);
      req->msg = m_worker->pack_msg<rpc::chunk>(
        m_id, std::string(Buffer::Data(buf),Buffer::Length(buf)));
      return req;
    }

    ShutdownReq*
    Stream::make_shutdown_req(){
      Stream *s = this;
      ShutdownReq *req = new ShutdownReq(s);
      return req;
    }
      
    template<class Event, typename... Args>
    bool
    Stream::send(Args&&... args){
      return m_worker->send<Event>(m_id, std::forward<Args>(args)...);
    }
      
  }
} // namespace cocaine::engine



