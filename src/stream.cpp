
#include "common.hpp"
#include "req.hpp"

namespace cocaine { namespace engine {
    
    //==== js->c api ====

    Handle<Value>
    Stream::WriteBuffer(const Arguments &args){
      switch(m_state){
        case st::reading:
          m_state = st::duplex;
          break;
        case st::read_end:
          m_state = st::writing;
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
      WriteReq *w = make_write_req(buf);
      m_write_queue_size += w.length;
      ngx_queue_append(&m_req_q,
                       &(w->m_req_q));
      set_want_write(true);
      return scope.Close(w->handle_);
    }

    Handle<Value>
    Stream::Shutdown(){
      HandleScope scope;
      switch(m_state){
        case st::start:
        case st::reading:
        case st::read_end:
          m_state = st::shutdown;
          m_shutdown_req = make_shutdown_req();
          m_worker->pending_enq(this);
          return scope.Close(m_shutdown_req->handle_);
        case st::duplex:
        case st::writing:
          m_state = st::shutdown;
          // this will cause all future writes to be
          // ignored and m_shutdown_req to be resolved
          // when there's no more pending writes left
          m_shutdown_req = make_shutdown_req();
          return scope.Close(m_shutdown_req->handle_);
        case st::shutdown:
          return ThrowException(
            String::New("shutdown on shutdown stream"));
        case st::closed:
          return ThrowException(
            String::New("shutdown on closed stream"));
        default:
          //XXX
      }
    }

    Handle<Value>
    Stream::Close(){
      if(m_state < st::closed){
        m_state = st::closed;
        //m_worker->writing_deq(this); // not. we'd rather
        //   check stream state after each callback in
        //   on_try_write or on_data instead
        m_worker->pending_enq(this);
      }
      return Undefined();
    }

    //==== js completion helpers ====

    void
    Stream::OnWrite(WriteReq *w){
      bool r=m_worker->send_raw(w->msg); // can throw
      if(r){
        w->on_complete();}
      return r;
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
          Local<Value>::New(b->handle_)}
        MakeCallback(handle_,onread_sym,1,argv);
      } else {
        SetErrno(UV_EOF);
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
      //Empty
    }

    Stream::~Stream(){
      assert(m_state = st::closed);
    }

    Handle<Value>
    Stream::New(const Arguments &args){
      if(!args.IsConstructCall()){
        return FromConstructorTemplate(stream_constructor_,args);
      }
      return args.This();
    }
      
    Stream*
    Stream::New(const uint64_t& id,
                worker_t *const worker){
      Stream *s = new Stream(id,worker);
      s->Wrap(s_constructor_->GetFunction()->NewInstance(0,NULL));
      return s;
    }

    void
    Stream::Initialize(Handle<Object> target){
      stream_constructor_ = Persistent<FunctionTemplate>::New(
        FunctionTemplate::New(New));
      sstream_constructor_->InstanceTemplate()->SetInternalFieldCount(1);
      NODE_SET_PROTOTYPE_METHOD(stream_constructor_, "writeBuffer", WriteBuffer);
      NODE_SET_PROTOTYPE_METHOD(stream_constructor_, "shutdown", Shutdown);
      NODE_SET_PROTOTYPE_METHOD(stream_constructor_, "close", Close);
      target->Set(String::NewSymbol("Stream"),stream_constructor_->GetFunction());
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
    }
      
    bool
    Stream::on_try_write1(){
      if(m_state < st::closed){
        assert(m_want_write
               && !(ngx_queue_empty(&m_req_q)));
        ngx_queue_t *q = ngx_queue_head(&m_req_q);
        WriteReq *w = ngx_queue_data(&m_req_q,
                                     WriteReq,
                                     m_req_q);

        if(!OnWrite(w)){ // can throw
          return false;
        }
        ngx_queue_remove(q);
        delete w;
        
        if(ngx_queue_empty(&m_writereq_q)){
          set_want_write(false);
        }
        return true;
      }
    }

    void
    Stream::on_data(char *data, size_t size){
      switch(m_state){
        case st::reading:
        case st::duplex:
          break;
        case st::read_ended:
        case st::writing;
        case st::shutdown:
        case st::closed:
          // drop or throw
          return;
      }
      Buffer *b=Buffer::New(const_cast<char*>(data),len); //make some heat
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
        case st::writing;
        case st::shutdown:
        case st::closed:
          //drop incoming message
          return;
      }
      OnRead(NULL);
    }

    void
    Stream::on_error(error_code code,
                     std::string& message){
      if(m_state != st::closed){
        m_state = st::closed;
        send<rpc::error>(static_cast<int>(code), message);
        send<rpc::choke>();
        OnClose();
      }
    }

    //================

    boost::shared_ptr<Stream::Shared>
    Stream::MakeShared(const uint64_t& id,
                       worker_t * const worker){
      return boost::make_shared<Stream::Shared>(
        Stream::New(id,worker));
    }

    void
    Stream::set_want_write(bool want){
      if(want && !m_want_write){
        assert(state != st::shutdown && state != st::closed);
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
        q = ngx_queue_head(&m_wrreq_q);
        ngx_queue_remove(q);
        WriteWrap *w = ngx_queue_data(q,WriteWrap,m_req_q);
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
        m_id, std::string(buf->Data(),buf->Length()));
      return req;
    }

    ShutdownReq*
    Stream::make_shutdown_req(){
      ShutdownReq *req = new ShutdownReq(this);
      return req;
    }
      
    template<class Event, typename... Args>
    bool
    Stream::send(Args&&... args){
      return m_worker->send<Event>(m_id, std::forward<Args>(args)...);
    }
      
  }
} // namespace cocaine::engine



