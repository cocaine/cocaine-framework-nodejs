
#include "worker.hpp"

namespace cocaine { namespace engine {

#define printf(...) printf(__VA_ARGS__); fflush(stdout)

    NodeWorker::NodeWorker(context_t& context,
               worker_config_t config):
      m_context(context),
      m_log(new log_t(context, format("app/%s", config.app))),
      m_id(config.uuid),
      m_state(st::start),
      m_channel(context, ZMQ_DEALER, m_id),
      m_loop(uv_default_loop()),
      m_want_write(false),
      m_want_prepare(false)
    {
      m_endpoint = format(
        "ipc://%1%/engines/%2%",
        m_context.config.path.runtime,
        config.app);

      int z0 = 0;

      m_channel.setsockopt(ZMQ_SNDTIMEO, &z0, sizeof(z0)); //non-blocking, eh?
      m_channel.setsockopt(ZMQ_RCVTIMEO, &z0, sizeof(z0)); //non-blocking, eh?
      
      m_channel.connect(m_endpoint);
      
      printf(
        "%s: evening everybody, fd %d\n",
        m_id.string().c_str(),m_channel.fd());
  
      m_watcher = new uv_poll_t;
      uv_poll_init(m_loop,m_watcher,m_channel.fd());
      m_watcher->data=this;
      m_watcher_enabled = false;

      m_prepare = new uv_prepare_t;
      uv_prepare_init(m_loop,m_prepare);
      m_prepare->data=this;
      m_prepare_enabled = false;

      m_timer = new uv_timer_t;
      uv_timer_init(m_loop, m_timer);
      m_timer->data = this;
      
      ngx_queue_init(&m_writing_q);
      ngx_queue_init(&m_pending_q);

      // m_check = new uv_check_t;
      // uv_check_init(m_loop,m_check);
      // m_check->data=this;

      try {
        m_manifest.reset(new manifest_t(m_context, config.app));
        m_profile.reset(new profile_t(m_context, config.profile));
      } catch(const std::exception& e) {
        terminate(rpc::suicide::abnormal, e.what());
        throw;
      } catch(...) {
        terminate(rpc::suicide::abnormal, "unexpected exception");
        throw;
      }
    
    }

    NodeWorker::~NodeWorker(){
      assert(m_state == st::stop);
      delete m_loop;
      delete m_watcher;
      delete m_prepare;
    }

    Handle<Value> // it's ok
    NodeWorker::New(const Arguments &args) {
      if(!args.IsConstructCall()){
        return ThrowException(
          Exception::Error(
            String::New("Worker: not a construct call")));}
      if(!(args.Length() == 1 &&
           args[0]->IsObject())){
        return ThrowException(
          Exception::TypeError(
            String::New("new Worker(<options>): options should be an Object")));
      }

      HandleScope scope;

      Local<Object> opts = Local<Object>::New(args[0]->ToObject());
  
#define _SYM NODE_PSYMBOL
      String::Utf8Value
        app(opts->Get(_SYM("app"))),
        uuid(opts->Get(_SYM("uuid"))),
        profile(opts->Get(_SYM("profile"))),
        configuration(opts->Get(_SYM("configuration")));
#undef _SYM

      worker_config_t *config = new worker_config_t();
      config->app          = *app;
      config->uuid         = *uuid;
      config->profile      = *profile;
      std::string config_path     = *configuration;

      context_t *context; 
      try{
        context = new context_t(config_path,
                                "slave");
      } catch(const std::exception &e){
        return ThrowException(
          Exception::Error(
            String::New("unable to initialize context")));
      }

      NodeWorker *worker;
      try{
        worker = new NodeWorker(*context,
                                *config);
      }catch(const std::exception &e){
        std::unique_ptr<log_t> log(
          new log_t(*context,"main"));
        printf(
          "unable to start the worker - %s\n",
          e.what());
        return ThrowException(
          Exception::Error(
            String::New("unsble to start the worker")));
      }

      worker->Wrap(args.This());
      return args.This();
    }



    void
    NodeWorker::uv_on_check(uv_check_t *hdl, int status){
      // assert(status == 0);
      // NodeWorker *w = (NodeWorker*)hdl->data;
      // assert(w->m_check == hdl);
      // w->process_prepare();
    }

    void
    NodeWorker::uv_on_prepare(uv_prepare_t *hdl, int status){
      assert(status == 0);
      NodeWorker *w = (NodeWorker*)hdl->data;
      assert(w->m_prepare == hdl);
      w->process_prepare();
    }

    void
    NodeWorker::uv_on_timer(uv_timer_t *hdl, int status){
      printf("uv_on_timer\n");
      assert(status == 0);
      NodeWorker *w = (NodeWorker*)hdl->data;
      assert(w->m_timer == hdl);
      w->uv_on_event(w->m_watcher,0,UV_READABLE);
    }

    void
    NodeWorker::uv_on_event(uv_poll_t *hdl,int status, int events){
      printf("uv_on_event\n");
      assert(status == 0);
      NodeWorker *w = (NodeWorker*)hdl->data;
      assert(w->m_watcher == hdl);
      if(events & UV_WRITABLE){
        w->process_writable();
      }
      if(events & UV_READABLE){
        w->process_readable();
      }
    }

    void
    NodeWorker::process_prepare(){
      printf("process_prepare\n");
      while(true){
        if(m_state == st::stop
           && m_stop_pending){
          m_stop_pending = false;
          set_want_prepare(false);
          on_stop();
          return;
        }
        if(m_state == st::shutdown
           && m_shutdown_pending){
          m_shutdown_pending = false;
          on_shutdown();
        }
        if((int)st::start < (int)m_state
           && (int)m_state < (int)st::stop
           && !ngx_queue_empty(&m_pending_q)){
          printf("do pending request\n");
          ngx_queue_t *q = ngx_queue_head(&m_pending_q);
          Stream *s = ngx_queue_data(q,Stream,m_pending_q);
          assert(s->m_worker == this);
          ngx_queue_remove(q);
          ngx_queue_init(q);
          s->on_prepare();
        } else {
          break;
        }
      }
      set_want_prepare(false);
    }

    void
    NodeWorker::process_writable(){
      printf("process_writable\n");
      while(true){
        if(!((int)st::start < (int)m_state
             && (int)m_state < (int)st::stop)){
          break;}
        if(ngx_queue_empty(&m_writing_q)){
          set_want_write(false);
          break;}
        printf("gonna write\n");
        ngx_queue_t *q = ngx_queue_head(&m_writing_q);
        Stream *s = ngx_queue_data(q,Stream,m_writing_q);
        printf("got hdl %x, stream %x\n",q,s);
        bool r;
        try {
          r = s->on_try_write1();
          printf("after write\n");
        } catch (std::exception &e){
          printf("after exception\n");
          terminate(rpc::suicide::abnormal, e.what());
          break;
        } catch (...){
          printf("unknown exception\n");
          r = false;
        }
        if(!r){
          break;
        }
        process_prepare();
      }
    }

    void
    NodeWorker::process_readable() {
      printf("process_readable\n");
      int counter = defaults::io_bulk_size;

      std::string blob;
      io::message_t message;

      while(m_state == st::running && counter--) {
        printf("process_readable iteration\n");
        if(!m_channel.recv(blob)){
          printf("  no messages\n");
          return;
        }
        message = io::codec::unpack(blob);

        printf(
          "worker %s received type %d message\n",
          m_id.string().c_str(),
          message.id());

        switch(message.id()) {
          case event_traits<rpc::heartbeat>::id:
            on_heartbeat();
            break;
          case event_traits<rpc::invoke>::id:
            on_invoke(message);
            break;
          case event_traits<rpc::chunk>::id: 
            on_chunk(message);
            break;
          case event_traits<rpc::choke>::id:
            on_choke(message);
            break;
          case event_traits<rpc::terminate>::id:
            on_shutdown();
            break;
          default:
            printf( //warning
              "worker %s dropping unknown type %d message\n", 
              m_id.string().c_str(),
              message.id());
            m_channel.drop();
        }

        process_prepare();
      }
    }

    //==== js->c api ====

    Handle<Value>
    NodeWorker::Listen(const Arguments &args){
      NodeWorker *w=ObjectWrap::Unwrap<NodeWorker>(args.This());
      assert(w->m_state == st::start);
      w->Ref();
      return Integer::New(
        w->listen());
    }

    Handle<Value>
    NodeWorker::Heartbeat(const Arguments &args){
      NodeWorker *w=ObjectWrap::Unwrap<NodeWorker>(args.This());
      if(w->m_state == st::running
         || w->m_state == st::shutdown){
        try{
          return Boolean::New(
            w->send<rpc::heartbeat>());
        } catch (std::exception &e){
          return ThrowException(
            Exception::Error(
              String::New(e.what())));
        }
      } else {
        return Undefined();
      }
    }

    Handle<Value>
    NodeWorker::Shutdown(const Arguments &args){
      NodeWorker *w=ObjectWrap::Unwrap<NodeWorker>(args.This());
      assert((int)st::start < (int)w->m_state);
      if((int)w->m_state < (int)st::shutdown){
        printf("worker <%p> got shutdown request\n",(void*)w);
        w->m_shutdown_pending = true;
        w->m_state = st::shutdown;
        w->set_want_prepare(true);
      }
      return Undefined();
    }
      
    Handle<Value>
    NodeWorker::Stop(const Arguments &args){
      NodeWorker *w=ObjectWrap::Unwrap<NodeWorker>(args.This());
      assert((int)st::start < (int)w->m_state);
      if((int)w->m_state < (int)st::stop){
        w->m_stop_pending = true;
        w->m_state = st::stop;
        w->set_want_prepare(true);
      }
      return Undefined();
    }

    //==== js completion helpers

    void
    NodeWorker::OnConnection(Stream *s){
      HandleScope scope;
      Local<Value> argv[1] =
        {Local<Value>::New(s->handle_)};
      MakeCallback(handle_,onconnection_sym,1,argv);
    }

    void
    NodeWorker::OnHeartbeat(){
      MakeCallback(handle_,onheartbeat_sym,0,NULL);
    }


    //==== loop callbacks

    void
    NodeWorker::on_invoke(io::message_t &message){
      uint64_t session_id;
      std::string event;

      message.as<rpc::invoke>(session_id, event);

      printf(
        "worker %s session %x: received event %s\n",
        m_id.string().c_str(),session_id,event.c_str());

      std::shared_ptr<Stream::Shared> stream(
        Stream::MakeShared(session_id,this));

      try {
        m_streams.insert(std::make_pair(session_id, stream));

        printf(
          "worker %s session %x: started session\n",
          m_id.string().c_str(),session_id);

        OnConnection(&(**stream));
            
      } catch(const std::exception& e) {
        (*stream)->on_error(invocation_error, e.what());
      } catch(...) {
        (*stream)->on_error(invocation_error, "unexpected exception");
      }
    }

    void
    NodeWorker::on_chunk(io::message_t &message){
      uint64_t session_id;
      std::string chunk;

      message.as<rpc::chunk>(session_id, chunk);
              
      printf(
        "worker %s session %x: received chunk length %d\n",
        m_id.string().c_str(),session_id,chunk.size());
            
      stream_map_t::iterator it(m_streams.find(session_id));

      // NOTE: This may be a chunk for a failed invocation, in which case there
      // will be no active stream, so drop the message.
      if(it != m_streams.end()) {
        try {
          (*(it->second))->on_data(const_cast<char*>(chunk.data()),
                                   chunk.size());
        } catch(const std::exception& e) {
          (*(it->second))->on_error(invocation_error, e.what());
        } catch(...) {
          (*(it->second))->on_error(invocation_error, "unexpected exception");
        }
      }

    }

    void
    NodeWorker::on_choke(io::message_t &message){
      uint64_t session_id;

      message.as<rpc::choke>(session_id);

      std::cout << "worker got <end> event" << std::endl;

      printf(
        "worker %s session %x: received close\n",
        m_id.string().c_str(),session_id);

      stream_map_t::iterator it = m_streams.find(session_id);

      // NOTE: This may be a choke for a failed invocation, in which case there
      // will be no active stream, so drop the message.
      if(it != m_streams.end()) {
        try {
          printf(
            "worker %s session %x: input end\n",
            m_id.string().c_str(),session_id);

          (*(it->second))->on_end();
              
        } catch(const std::exception& e) {
          (*(it->second))->on_error(invocation_error, e.what());
        } catch(...) {
          (*(it->second))->on_error(invocation_error, "unexpected exception");
        }
      }
    }

    void
    NodeWorker::on_shutdown(){
      assert(m_state == st::shutdown
             && !m_shutdown_done);
      m_shutdown_done = true;
      stream_map_t::iterator it0, it1;
      for(it0 = m_streams.begin();
          it0 != m_streams.end();
          it0 = it1){
        it1 = it0;
        ++it1;
        (*(it0->second))->on_shutdown(); // this will call m_streams.erase(stream.id)
      }
    }

    void
    NodeWorker::on_stop(){
      assert(m_state == st::stop
             && !m_stop_done);
      m_stop_done = true;
      stream_map_t::iterator it0, it1;
      for(it0 = m_streams.begin();
          it0 != m_streams.end();
          it0 = it1){
        it1 = it0;
        ++it1;
        (*(it0->second))->on_stop();
      }
      Unref(); // all base belongs to js
    }

    void
    NodeWorker::on_terminate(){
      terminate(rpc::suicide::normal, "per request");
    }

    void
    NodeWorker::on_heartbeat(){
      std::cout << "got heartbeat" << std::endl;
      OnHeartbeat();
    }

    //================

    int
    NodeWorker::listen(){
      printf("listen\n");
      if(m_state == st::start){
        int z0=0;
        try{
          //m_channel.connect(m_endpoint);
          ;
        } catch (zmq::error_t &e){
          //SetErrno(65535);
          m_state = st::stop;
          return e.num();
        } catch (std::exception &e){
          m_state = st::stop;
          return 65535;
        }
        m_state = st::running;
        update_watchers_state();
        bool r=send<rpc::heartbeat>();
        if(!r){
          m_state = st::stop;
          return 65534;
        }
        return 0;
      }
      return -1;
    }

    void
    NodeWorker::terminate(rpc::suicide::reasons reason,
                          const std::string& message){
      send<rpc::suicide>(static_cast<int>(reason), message);
      m_stop_pending = true;
      m_state = st::stop;
      set_want_prepare(true);
    }

    void
    NodeWorker::set_want_write(bool want){
      if(want && !m_want_write){
        m_want_write = true;
        update_watchers_state();
      } else if(!want && m_want_write) {
        m_want_write = false;
        update_watchers_state();
      }
    }

    void
    NodeWorker::set_want_prepare(bool want){
      if(want && !m_want_prepare){
        m_want_prepare = true;
        update_watchers_state();
      } else if(!want && m_want_prepare) {
        m_want_prepare = false;
        update_watchers_state();
      }
    }

    void
    NodeWorker::update_watchers_state(){
      int events = 0;
      if(m_state == state_t::stop){
        printf("stop poll\n");
        if(m_watcher_enabled){
          printf("actually stop\n");
          uv_timer_stop(m_timer);
          uv_poll_stop(m_watcher);
          m_watcher_enabled = false;}
      } else {
        if(m_want_write){
          events |= UV_WRITABLE;}
        if(m_state != state_t::shutdown){
          events |= UV_READABLE;}
        printf("start poll, events %x\n",events);
        uv_poll_start(m_watcher,events,NodeWorker::uv_on_event);
        uv_timer_start(m_timer,NodeWorker::uv_on_timer, 0, 100000);
        m_watcher_enabled = true;
      }
      if(m_want_prepare){
        printf("start prepare\n");
        uv_prepare_start(m_prepare,NodeWorker::uv_on_prepare);
        m_prepare_enabled = true;
        //uv_check_start(m_check,NodeWorker::uv_on_chuck);
      }else{
        printf("stop prepare\n");
        if(m_prepare_enabled){
          printf("actually stop\n");
          uv_prepare_stop(m_prepare);
          m_prepare_enabled = false;
        }
        //uv_check_stop(m_check);
      }
    }

    void
    NodeWorker::writing_enq(Stream *s){
      assert(ngx_queue_empty(&(s->m_writing_q)));
      ngx_queue_insert_tail(
        &m_writing_q,
        &(s->m_writing_q));
      printf("writing_enq stream %p, hdl %p\n",&(s->m_writing_q));
      printf("  or, last: %p\n",ngx_queue_last(&m_writing_q));
      printf("  and offset is %d\n",offsetof(Stream,m_writing_q));
      set_want_write(true);
    }

    void
    NodeWorker::writing_deq(Stream *s){
      assert(!ngx_queue_empty(&(s->m_writing_q)));
      ngx_queue_remove(&(s->m_writing_q));
      ngx_queue_init(&(s->m_writing_q));
      if(ngx_queue_empty(&(m_writing_q))){
        set_want_write(false);}
    }

    void
    NodeWorker::pending_enq(Stream *s){
      assert(ngx_queue_empty(&(s->m_pending_q)));
      ngx_queue_insert_tail(
        &m_pending_q,
        &(s->m_pending_q));
      set_want_prepare(true);
    }

    void
    NodeWorker::pending_deq(Stream *s){
      assert(!ngx_queue_empty(&(s->m_pending_q)));
      ngx_queue_remove(&(s->m_pending_q));
      ngx_queue_init(&(s->m_pending_q));
      if(ngx_queue_empty(&(m_pending_q))){
        set_want_prepare(false);}
    }


    void
    NodeWorker::stream_remove(Stream *s){
      if(!ngx_queue_empty(&(s->m_pending_q))){
        ngx_queue_remove(&(s->m_pending_q));
        ngx_queue_init(&(s->m_pending_q));
      }
      if(!ngx_queue_empty(&(s->m_writing_q))){
        ngx_queue_remove(&(s->m_writing_q));
        ngx_queue_init(&(s->m_writing_q));
      }
      stream_map_t::iterator it =
        m_streams.find(s->id());
      if(it != m_streams.end()){
        m_streams.erase(it);
      }
    }      

    bool
    NodeWorker::send_raw(std::string &blob, int flags){
      return m_channel.send(blob,flags);
    }

    void
    NodeWorker::Initialize(Handle<Object> target){
      worker_constructor = Persistent<FunctionTemplate>::New(
        FunctionTemplate::New(New));
      worker_constructor->InstanceTemplate()->SetInternalFieldCount(1);
      NODE_SET_PROTOTYPE_METHOD(worker_constructor, "listen", Listen);
      NODE_SET_PROTOTYPE_METHOD(worker_constructor, "heartbeat", Heartbeat);
      NODE_SET_PROTOTYPE_METHOD(worker_constructor, "shutdown", Shutdown);
      NODE_SET_PROTOTYPE_METHOD(worker_constructor, "stop", Stop);
    
      target->Set(String::NewSymbol("Worker"),worker_constructor->GetFunction());

      printf("offset of Stream.m_writing_q: %d\n",
             (int)__builtin_offsetof(Stream,m_writing_q));

      printf("offset of Stream.m_id: %d\n",
             (int)__builtin_offsetof(Stream,m_id));

      oncomplete_sym = NODE_PSYMBOL("oncomplete");
      errno_sym = NODE_PSYMBOL("errno");
      buffer_sym = NODE_PSYMBOL("buffer");
      domain_sym = NODE_PSYMBOL("domain");
      bytes_sym = NODE_PSYMBOL("bytes");
      write_queue_size_sym = NODE_PSYMBOL("writeQueueSize");
      onconnection_sym = NODE_PSYMBOL("onconnection");
      process_sym = NODE_PSYMBOL("process");
      heartbeat_sym = NODE_PSYMBOL("heartbeat");
      onheartbeat_sym = NODE_PSYMBOL("onheartbeat");
      
    }
  }
}


