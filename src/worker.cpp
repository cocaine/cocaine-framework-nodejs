

#include "worker.hpp"


namespace cocaine { namespace engine {
    

    NodeWorker::NodeWorker(context_t& context,
               worker_config_t config):
      m_context(context),
      m_log(new log_t(context, cocaine::format("app/%s", config.app))),
      m_id(config.uuid),
      m_state(st::start),
      m_channel(context, ZMQ_DEALER, m_id),
      m_loop(uv_default_loop())
    {
      m_endpoint = cocaine::format(
        "ipc://%1%/engines/%2%",
        m_context.config.path.runtime,
        config.app);
      
      m_channel.connect(m_endpoint);

      COCAINE_LOG_INFO(
        m_log,
        "%s: evening everybody",
        m_id);
  
      m_watcher = new uv_poll_t;
      uv_poll_init(m_loop,m_watcher,m_channel.fd());
      m_watcher->data=this;

      m_prepare = new uv_prepare_t;
      uv_prepare_init(m_loop,m_prepare);
      m_prepare->data=this;

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
      BOOST_ASSERT(m_state == st::stop);
      delete m_loop;
      delete m_watcher;
      delete m_prepare;
    }

    static Handle<Value> // it's ok
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
        COCAINE_LOG_ERROR(
          log,
          "unable to start the worker - %s",
          e.what());
        return ThrowException(
          Exception::Error(
            String::New("unsble to start the worker")));
      }

      worker->Wrap(args.This());
      return args.This();
    }



    static void
    NodeWorker::uv_on_check(uv_check_t *hdl, int status){
      BOOST_ASSERT(status == 0);
      NodeWorker *w = (NodeWorker*)hdl->data;
      assert(w->m_check == hdl);
      w->process_prepare();
    }

    static void
    NodeWorker::uv_on_prepare(uv_prepare_t *hdl, int status){
      BOOST_ASSERT(status == 0);
      NodeWorker *w = (NodeWorker*)hdl->data;
      assert(w->m_prepare == hdl);
      w->process_prepare();
    }

    static void
    NodeWorker::uv_on_event(uv_poll_t *hdl,int status, int events){
      BOOST_ASSERT(status == 0);
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
          return;
        }
        if(ngx_queue_empty(&m_prepare_q)){
          break;}
        ngx_queue_t *q = ngx_queue_head(&m_prepare_q);
        Stream *s = ngx_queue_data(q,Stream,m_prepqre_q);
        assert(s->m_worker == this);
        ngx_queue_remove(q);
        ngx_queue_init(q);
        s->on_prepare();
      }
      set_want_prepare(false);
    }

    void
    NodeWorker::process_writable(){
      while(true){
        if(!(st::start < m_state &&
             m_state < st::stop)){
          break;}
        if(ngx_queue_empty(&m_writing_q)){
          set_want_write(false);
          break;}
        ngx_queue_t *q = ngx_queue_head(&m_writing_q);
        Stream *s = ngx_queue_data(q,Stream,m_writing_q);
        try {
          bool r = s->on_try_write1();}
        catch (std::exception &e){
          terminate(abnormal,e.what());
          break;}
        if(!r){
          break;}
        if(!s->m_want_write){
          ngx_queue_remove(q);}}}

    void
    NodeWorker::process_readable() {
      int counter = defaults::io_bulk_size;

      std::string blob;
      io::message_t message;

      while(m_state == st::running && counter--) {
        
        if(!m_channel.recv(blocb)){
          return;
        }
        message = io::codec::unpack(blob);

        COCAINE_LOG_DEBUG(
          m_log,
          "worker %s received type %d message",
          m_id,
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
            on_terminate();
            break;
          default:
            COCAINE_LOG_WARNING(
              m_log,
              "worker %s dropping unknown type %d message", 
              m_id,
              message.id());
            m_channel.drop();
        }
      }
    }







    //==== js->c api ====

    static Handle<Value>
    NodeWorker::Listen(const Arguments &args){
      BOOST_ASSERT(m_state == st::start);
      Ref();
      return Integer::New(
        listen());
    }

    static Handle<Value>
    NodeWorker::Heartbeat(const Arguments &args){
      if(m_state == st::running
         || m_statte == st::shutdown){
        try{
          return Boolean::New(
            send<rpc::heartbeat>());
        } catch (std::exception &e){
          return ThrowException(
            Exception::Error(
              String::New(e.what())))
            }
      } else {
        return Undefined();
      }
    }

    static Handle<Value>
    NodeWorker::Shutdown(const Arguments &args){
      BOOST_ASSERT(st::start < m_state);
      if(m_state < st::shutdown){
        m_shutdown_pending = true;
        m_state = st::shutdown;
        set_want_prepare(true);
      }
      return Undefined();
    }
      
    static Handle<Value>
    NodeWorker::Stop(const Arguments &args){
      BOOST_ASSERT(st::start < m_state)
        if(m_state < st::stop){
          m_stop_pending = true;
          m_state = st::stop;
          set_want_prepare(true);
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

      COCAINE_LOG_DEBUG(
        m_log,
        "worker %s session %x: received event %s",
        m_id,session_id,event);

      boost::shared_ptr<Stream::Shared> stream(
        Stream::MakeShared(session_id,this));

      try {
        m_streams.insert(std::make_pair(session_id, stream));

        COCAINE_LOG_ERROR(
          m_log,
          "worker %s session %x: started session",
          m_id,session_id);

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
              
      COCAINE_LOG_DEBUG(
        m_log,
        "worker %s session %x: received chunk length %d",
        m_id,session_id,chunk.size());
            
      stream_map_t::iterator it(m_streams.find(session_id));

      // NOTE: This may be a chunk for a failed invocation, in which case there
      // will be no active stream, so drop the message.
      if(it != m_streams.end()) {
        try {
          (*(it->second))->on_data(chunk.data(),
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

      COCAINE_LOG_ERROR(
        m_log,
        "worker %s session %x: received close",
        m_id,session_id);

      stream_map_t::iterator it = m_streams.find(session_id);

      // NOTE: This may be a choke for a failed invocation, in which case there
      // will be no active stream, so drop the message.
      if(it != m_streams.end()) {
        try {
          COCAINE_LOG_DEBUG(
            m_log,
            "worker %s session %x: input end",
            m_id,session_id);

          (*(it->second))->on_end();
          m_streams.erase(it);
              
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
        it1 = it0.next();
        (*(it0->second))->shutdown();
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
        it1 = it0.next();
        (*(it0->second))->close();
      }
      Unref(); // all base belongs to js
    }

    void
    NodeWorker::on_terminate(){
      terminate(rpc::suicide::normal, "per request");
    }

    void
    NodeWorker::on_heartbeat(){
      OnHeartbeat();
    }









    //================

    int
    NodeWorker::listen(){
      if(m_state == st::start){
        int z0=0;
        try{
          //m_channel.connect(m_endpoint);
          m_channel.setsockopt(ZMQ_SNDTIMEO, &z0, sizeof(z0)); //non-blocking, eh?
        } catch (zmq::error_t &e){
          SetErrno(e.num());
          m_state = st::stop;
          return e.num();
        } catch (std::exception &e){
          m_state = st::stop;
          return 65535;
        }
        m_state = st::running;
        bool r=send<rpc::heartbeat>();
        if(!r){
          m_state = st::stop;
          return 65534;
        }
        watchers_update_state();
        return 0;
      }
      return -1;
    }

    void
    NodeWorker::terminate(rpc::suicide::reasons reason,
              const std::string& message){
      send<rpc::terminate>(reson,message);
      m_stop_pending = true;
      m_state = st::stop;
      set_want_prepare(true);
    }

    void
    NodeWorker::set_want_write(bool want){
      if(want && !m_want_write){
        m_want_write = true;
        watchers_update_state();
      } else if(!want && m_want_write) {
        m_want_write = false;
        update_watchers_state();
      }
    }

    void
    NodeWorker::set_want_prepare(bool want){
      if(want && !m_want_prepare){
        m_want_prepare = true;
        watchers_update_state();
      } else if(!want && m_want_prepare) {
        m_want_prepare = false;
        update_watchers_state();
      }
    }

    void
    NodeWorker::update_watchers_state(){
      int events = 0;
      if(m_state == state_t::stop){
        uv_poll_stop(m_loop,m_watcher);
      } else {
        if(m_want_write){
          events |= UV_WRITABLE;}
        if(m_state != state_t::shutdown){
          events |= UV_READABLE;}
        uv_poll_start(m_watcher,events,NodeWorker::uv_on_event);
      }
      if(m_want_prepare){
        uv_prepare_start(m_prepare,NodeWorker::uv_on_prepare);
        //uv_check_start(m_check,NodeWorker::uv_on_chuck);
      }else{
        uv_prepare_stop(m_prepare);
        //uv_check_stop(m_check);
      }
    }

    void
    NodeWorker::writing_enq(Stream *s){
      assert(ngx_queue_empty(&(s->m_writing_q)));
      ngx_queue_insert_tail(
        &m_writing_q,
        &(s->m_writing_q));
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
        &(stream->m_pending_q));
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
        m_streams.find(s->m_id);
      if(it != m_streams.end()){
        m_streams.erase(it);
      }
    }      

    template<class Eevnt, typename... Args>
    std::string
    NodeWorker::pack_msg(Args&&... args) {
      return io::codec::pack<Event>(std::forward<Args>(args)...);
    }
    
    template<class Event, typename... Args>
    bool
    NodeWorker::send(Args&&... args) {
      return m_channel.send(io::codec::pack<Event>(std::forward<Args>(args)...));
    }

    bool
    NodeWorker::send_raw(std::string &blob,int flags = 0){
      return m_channel.send(blob,flags);
    }

    
  }
} 


