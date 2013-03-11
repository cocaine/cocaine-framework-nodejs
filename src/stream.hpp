

#include "common.hpp"
#include "req.hpp"

namespace cocaine { namespace engine {

    class Stream: public ObjectWrap 
    {
      enum class state_t: int {
        reading, read_ended, duplex, writing,
          shutdown, closed};

      class Shared;
      
      uint64_t  m_id;
      worker_t *m_worker;
      state_t   m_state;

      ShutdownReq *m_shutdown_req;

      ngx_queue_t m_writereq_q;
      ngx_queue_t m_writing_q;
      ngx_queue_t m_pending_q;

      size_t m_write_queue_size;
      size_t m_write_hwm;
      size_t m_write_lwm;

      bool m_want_write;
      bool m_shutdown_pending;
      bool m_close_pending;

      //==== js->c api ====
      
      static Handle<Value>
      WriteBuffer(const Arguments &args){
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
        ngx_queue_append(&m_writereq_q,
                         &(w->m_writereq_q));
        set_want_write(true);
        return scope.Close(w->handle_);
      }

      static Handle<Value>
      Shutdown(){
        HandleScope scope;
        switch(m_state){
          case st::start:
          case st::reading:
          case st::read_end:
            m_state = st::shutdown;
            m_shutdown_req = make_shutdown_req();
            m_worker->requests_enq(this);
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

      static Handle<Value>
      Close(){
        if(m_state < st::closed){
          m_state = st::closed;
          m_worker->requests_enq(this);
        }
        return Undefined();
      }











      //==== js completion helpers ====

      void
      AfterWrite(WriteReq *w){
        w->on_complete();
        delete w;
      }
      
      void
      AfterShutdown(){
        if(m_shutdown_req){
          m_shutdown_req->on_complete();
          delete m_shutdown_req;
          m_shutdown_req = NULL;
        }
        m_state = st::closed;
        OnClose();
      }


      void
      OnClose(){
        cancel_and_destroy_reqs();
        m_worker->stream_remove(this);
      }

      void
      OnRead(){
      }

      //================

      Stream(const uint64_t &id,
             NodeWorker *const worker):
        m_id(id),
        m_worker(worker),
        m_state(state_t::reading)
        {
          //Empty
        }

      ~Stream(){
        BOOST_ASSERT(m_state = st::closed);
      }

      static Handle<Value>
      New(const Arguments &args){
        if(!args.IsConstructCall()){
          return FromConstructorTemplate(stream_constructor_,args);
        }
        return args.This();
      }
      
      static Stream*
      New(const uint64_t& id,
          worker_t *const worker){
        Stream *s = new Stream(id,worker);
        s->Wrap(s_constructor_->GetFunction()->NewInstance(0,NULL));
        return s;
      }

      static void
      Initialize(Handle<Object> target){
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

      void
      on_shutdown(){
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

      void
      on_stop(){
        if(m_state != st::closed){
          m_state = st::closed;
          OnClose();
        }
      }
      
      bool
      on_prepare(){
        if(m_state == st::closed){
          OnClose();
        }
        if(m_state == st::shutdown){
          if(ngx_queue_empty(&m_writing_reqs_q)){
            AfterShutdown();
          }
        }
      }
      
      bool
      on_try_write1(){
        assert(m_want_write
               && !(ngx_queue_empty(&m_write_req)));
        ngx_queue_t *q = ngx_queue_head(&m_writereq_q);
        WriteReq *w = ngx_queue_data(&m_writereq_q,
                                     WriteReq,
                                     m_writereq_q);

        bool r = m_worker->send_raw(w->msg); // can throw
        
        if(!r){
          return false;}

        if(ngx_queue_empty(&m_writereq_q)){
          set_want_write(false);
        }
        
        AfterWrite(w);
        return true;
      }

      void
      on_data(char *data, size_t size){
        HandleScope scope;
        Buffer *b=Buffer::New(const_cast<char*>(data),len); //make some heat
        Local<Value> argv[1] =
          {Local<Value>::New(b->handle_)};
        MakeCallback(handle_,onread_sym,1,argv);
      }

      void
      on_end(){
        HandleScope scope;
        SetErrno(UV_EOF);
        MakeCallback(handle_,onread_sym,0,NULL);
      }

      void
      on_error(){
        if(m_state != st::closed){
          m_state = st::closed;
          send<rpc::error>(static_cast<int>(code), message);
          send<rpc::choke>();
          OnClose();
        }
        
      }

      //================

      boost::shared_ptr<Stream::Shared>
      MakeShared(const uint64_t& id,
                         worker_t * const worker){
        return boost::make_shared<Stream::Shared>(
          Stream::New(id,worker));
      }

      void
      set_want_write(bool want){
        if(want && !m_want_write){
          BOOST_ASSERT(state != st::shutdown && state != st::closed);
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
      cancel_and_destroy_reqs(){
        ngx_queue_t* q = NULL;
        while(!ngx_queue_empty(&m_writereq_q)){
          q = ngx_queue_head(&m_writereq_q);
          ngx_queue_remove(q);
          WriteWrap *w = ngx_queue_data(q,WriteWrap,m_writereq_q);
          BOOST_ASSERT(w->stream == this);
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
      make_write_req(Handle<Object> buf){
        WriteReq *req = new WriteReq();
        req->stream = this;
        req->length = Buffer::Length(buf);
        req->msg = m_worker->pack_msg<rpc::chunk>(
          m_id, std::string(buf->Data(),buf->Length()));
        req->object_->SetHiddenValue(buffer_sym, buf->handle_);
        return req;
      }

      ShutdownReq*
      make_shutdown_req(){
        ShutdownReq *req = new ShutdownReq();
        req->stream = this;
        return req;
      }
      
      template<class Event, typename... Args>
      bool
      send(Args&&... args){
        return m_worker->send<Event>(m_id, std::forward<Args>(args)...);
      }
      
    };


    class Stream::Shared {
    private:
      Stream *stream_;
  
    public:

      Shared(Stream *stream){
        assert(stream);
        stream_=stream;
        stream_->Ref();
      }

      ~Shared(){
        assert(stream_);
        stream_->Unref();
      }

      Stream&
      operator*(){
        BOOST_ASSERT(stream_);
        return *stream_;
      }

      Stream*
      operator->(){
        BOOST_ASSERT(stream_);
        return stream_;
      }

    };

  }
} // namespace cocaine::engine


#endif

