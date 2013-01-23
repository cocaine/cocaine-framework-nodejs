
#include "stream.hpp"
#include "worker.hpp"
#include <stdio.h>


namespace cocaine { namespace engine {
    
    Persistent<FunctionTemplate> w_constructor_;

    Persistent<String> on_open_sym;
    Persistent<String> on_stop_sym;

    
    void
    worker_t::on_open(std::string &evt, Stream *s){
      HandleScope scope;
      Local<Value> cb = this->handle_->Get(on_open_sym);
      if(!cb->IsFunction()){
        return;
      }
      Local<Value> argv[1] =
        {Local<Value>::New(s->handle_)};
      TryCatch try_catch;
      cb.As<Function>()->Call(this->handle_,1,argv);
    }
      
    void
    worker_t::on_stop(){
      HandleScope scope;
      Local<Value> cb = this->handle_->Get(on_stop_sym);
      if(!cb->IsFunction()){
        return;
      }
      cb.As<Function>()->Call(this->handle_,0,NULL);
    }

    worker_t::worker_t(context_t& context,
                       worker_config_t config):
      m_context(context),
      m_log(new log_t(context, cocaine::format("app/%s", config.app))),
      m_id(config.uuid),
      m_channel(context, ZMQ_DEALER, m_id),
      m_loop(uv_default_loop())
    {
      std::string endpoint = cocaine::format(
        "ipc://%1%/engines/%2%",
        m_context.config.path.runtime,
        config.app);

      m_channel.connect(endpoint);

      COCAINE_LOG_ERROR(
        m_log,
        "%s: evening everybody",
        m_id);
  
      m_watcher_uv = new uv_poll_t;
      uv_poll_init(m_loop,m_watcher_uv,m_channel.fd());
      m_watcher_uv->data=this;

      m_checker_uv = new uv_prepare_t;
      uv_prepare_init(m_loop,m_checker_uv);
      m_checker_uv->data=this;

      m_heartbeat_timer_uv = new uv_timer_t;
      uv_timer_init(m_loop,m_heartbeat_timer_uv);
      m_heartbeat_timer_uv->data=this;

      // Launching the app

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
    
      m_disown_timer_uv = new uv_timer_t;
      uv_timer_init(m_loop,m_disown_timer_uv);
      m_disown_timer_uv->data=this;

    }

    worker_t::~worker_t() {
      uv_poll_stop(m_watcher_uv);
      uv_prepare_stop(m_checker_uv);
      uv_timer_stop(m_heartbeat_timer_uv);
      uv_timer_stop(m_disown_timer_uv);  
    }

    void
    worker_t::run() {
      uv_poll_start(m_watcher_uv, UV_READABLE, worker_t::uv_on_event);
      uv_prepare_start(m_checker_uv,worker_t::uv_on_check);
      uv_timer_start(m_heartbeat_timer_uv,
                     worker_t::uv_on_heartbeat,
                     0,5000);
      uv_timer_start(m_disown_timer_uv,
                     worker_t::uv_on_disown,
                     m_profile->heartbeat_timeout*1000,0);  
    }

    void
    worker_t::uv_on_event(uv_poll_t* hdl, int status, int events) {
      BOOST_ASSERT(status==0);
      worker_t *w = static_cast<worker_t*>(hdl->data);
      w->on_event();
    }

    void
    worker_t::on_event(){
      uv_prepare_stop(m_checker_uv);

      if(m_channel.pending()) {
        uv_prepare_start(m_checker_uv,worker_t::uv_on_check);
        process();
      }
    }

    void
    worker_t::uv_on_check(uv_prepare_t *hdl,int) {
      //XXX
      //m_loop.feed_fd_event(m_channel.fd(), ev::READ);
    }

    void
    worker_t::uv_on_heartbeat(uv_timer_t *hdl,int) {
      worker_t *w = static_cast<worker_t*>(hdl->data);
      scoped_option<
        options::send_timeout
        > option(w->m_channel, 0);
      w->send<rpc::heartbeat>();
    }

    void
    worker_t::uv_on_disown(uv_timer_t *hdl,int) {
      worker_t *w = static_cast<worker_t*>(hdl->data);
      COCAINE_LOG_ERROR(
        w->m_log,
        "worker %s has lost the controlling engine",
        w->m_id);
      //XXX
      //m_loop.unloop(uv::ALL);
    }

    void
    worker_t::process() {
      int counter = defaults::io_bulk_size;

      do {
        // TEST: Ensure that we haven't missed something in a previous iteration.
        BOOST_ASSERT(!m_channel.more());
       
        int message_id = -1;

          {
            scoped_option<
              options::receive_timeout
              > option(m_channel, 0);

            if(!m_channel.recv(message_id)) {
              return;
            }
          }

          COCAINE_LOG_ERROR(
            m_log,
            "worker %s received type %d message",
            m_id,
            message_id);

          switch(message_id) {
            case event_traits<rpc::heartbeat>::id:
              uv_timer_stop(m_disown_timer_uv);
              uv_timer_start(m_disown_timer_uv,
                             worker_t::uv_on_heartbeat,
                             (int)(m_profile->heartbeat_timeout*1000),0);
              break;

            case event_traits<rpc::invoke>::id: {
              unique_id_t session_id(uninitialized);
              std::string event;

              m_channel.recv<rpc::invoke>(session_id, event);

              COCAINE_LOG_ERROR(
                m_log,
                "worker %s session %s: received event %s",
                m_id,session_id.string(),event);

              boost::shared_ptr<Stream::Shared> stream(
                Stream::MakeShared(session_id,this));

              try {
                m_streams.emplace(session_id, stream);

                COCAINE_LOG_ERROR(
                  m_log,
                  "worker %s session %s: started session",
                  m_id,session_id.string());

                on_open(event,&(**stream));
            
              } catch(const std::exception& e) {
                (*stream)->error(invocation_error, e.what());
              } catch(...) {
                (*stream)->error(invocation_error, "unexpected exception");
              }

              break;
            }

            case event_traits<rpc::chunk>::id: {
              unique_id_t session_id(uninitialized);
              std::string message;

              m_channel.recv<rpc::chunk>(session_id, message);
              COCAINE_LOG_ERROR(
                m_log,
                "worker %s session %s: received chunk length %d",
                m_id,session_id.string(),message.size());
            
              stream_map_t::iterator it(m_streams.find(session_id));

              // NOTE: This may be a chunk for a failed invocation, in which case there
              // will be no active stream, so drop the message.
              if(it != m_streams.end()) {
                try {
                  (*(it->second))->on_data(message.data(),
                                           message.size());
                } catch(const std::exception& e) {
                  (*(it->second))->error(invocation_error, e.what());
                  m_streams.erase(it);
                } catch(...) {
                  (*(it->second))->error(invocation_error, "unexpected exception");
                  m_streams.erase(it);
                }
              }

              break;
            }

            case event_traits<rpc::choke>::id: {
              unique_id_t session_id(uninitialized);

              m_channel.recv<rpc::choke>(session_id);

              COCAINE_LOG_ERROR(
                m_log,
                "worker %s session %s: received close",
                m_id,session_id.string());

              stream_map_t::iterator it = m_streams.find(session_id);

              // NOTE: This may be a choke for a failed invocation, in which case there
              // will be no active stream, so drop the message.
              if(it != m_streams.end()) {
                try {
                  COCAINE_LOG_ERROR(
                    m_log,
                    "worker %s session %s: input end",
                    m_id,session_id.string());

                  (*(it->second))->on_end();
                  m_streams.erase(it);
              
                } catch(const std::exception& e) {
                  (*(it->second))->error(invocation_error, e.what());
                } catch(...) {
                  (*(it->second))->error(invocation_error, "unexpected exception");
                }
                    
              }

              break;
            }
            
            case event_traits<rpc::terminate>::id:
              terminate(rpc::suicide::normal, "per request");
              break;

            default:
              COCAINE_LOG_WARNING(
                m_log,
                "worker %s dropping unknown type %d message", 
                m_id,
                message_id
                );
                
              m_channel.drop();
          }
      } while(--counter);

      // Feed the event loop.
      //m_loop.feed_fd_event(m_channel.fd(), uv::READ);
      //XXX

    }

    void
    worker_t::terminate(rpc::suicide::reasons reason,
                        const std::string& message)
    {
      send<rpc::suicide>(static_cast<int>(reason), message);
      //m_loop.unloop(uv::ALL);
      //XXX
      exit(0);
    }

    Handle<Value>
    worker_t::New(const Arguments &args) {

      if(!args.IsConstructCall()){
        return ThrowException(
          Exception::Error(
            String::New("Worker: not a construct call")));
      }
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
        std::cerr << "Error: unable to initialie "
          "the context - " << e.what() << std::endl;
        return scope.Close(Integer::New(EXIT_FAILURE));
      }

      worker_t *worker;
      try{
        worker = new worker_t(*context,
                              *config);
      }catch(const std::exception &e){
        std::unique_ptr<log_t> log(
          new log_t(*context,"main"));
        COCAINE_LOG_ERROR(
          log,
          "unable to start the worker - %s",
          e.what());
        return scope.Close(Integer::New(EXIT_FAILURE));
      }

      worker->Wrap(args.This());

  
      return args.This();

    }

    Handle<Value>
    worker_t::Run(const Arguments &args){
      worker_t *w=ObjectWrap::Unwrap<worker_t>(args.This());
      w->run();
      return args.This();
    }


    void
    worker_t::Initialize(Handle<Object> target) {
      w_constructor_ = Persistent<FunctionTemplate>::New(
        FunctionTemplate::New(New));
      w_constructor_->InstanceTemplate()->SetInternalFieldCount(1);
      NODE_SET_PROTOTYPE_METHOD(w_constructor_, "run", Run);
    
      target->Set(String::NewSymbol("Worker"),w_constructor_->GetFunction());

      on_open_sym = NODE_PSYMBOL("_on_open");
      on_stop_sym = NODE_PSYMBOL("_on_stop");
  
    }
    
    
  }
} // namespace cocaine::engine



void Initialize(Handle<Object> target) {
  cocaine::engine::Stream::Initialize(target);
  cocaine::engine::worker_t::Initialize(target);
  ::freopen("/tmp/cocaine.log","a",stdout);
  ::freopen("/tmp/cocaine.log","a",stderr);

}

NODE_MODULE(cocaine, Initialize);


