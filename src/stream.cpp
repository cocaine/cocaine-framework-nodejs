
#include "stream.hpp"
#include "worker.hpp"


namespace cocaine { namespace engine {
    
    Persistent<FunctionTemplate> s_constructor_;

    Persistent<String> on_data_sym;
    Persistent<String> on_end_sym;

    
    boost::shared_ptr<Stream::Shared>
    Stream::MakeShared(const unique_id_t& id,
               worker_t * const worker){
      return boost::make_shared<Stream::Shared>(
        Stream::New(id,worker));
    }

    Stream*
    Stream::New(const unique_id_t& id,
                worker_t *const worker){
      Stream *s = new Stream(id,worker);
      s->Wrap(s_constructor_->GetFunction()->NewInstance(0,NULL));
      return s;
    }

    Stream::~Stream(){
      if(m_state != state_t::closed){
        close();
      }
    }

    template<class Event, typename... Args>
    void
    Stream::send(Args&&... args){
      m_worker->send<Event>(m_id, std::forward<Args>(args)...);
    }


    //---- js->c ----

    Handle<Value>
    Stream::New(const Arguments &args){
      if(!args.IsConstructCall()){
        return FromConstructorTemplate(s_constructor_,args);
      }
      return args.This();
    }

    Handle<Value>
    Stream::Write(const Arguments &args){
      //args[0] is string
      int argc = args.Length();
      if(!(argc==1 && Buffer::HasInstance(args[0]))){
        return ThrowException(
          Exception::TypeError(
            String::New("arg[0] has to be a Buffer")));
      }
      
      Stream *s=ObjectWrap::Unwrap<Stream>(args.This());
      if(!(s->m_state==state_t::open)){
        return ThrowException(
          Exception::Error(
            String::New("writing to a closed stream")));
      }

      Local<Object> b = args[0]->ToObject();
    
      char *chunk=Buffer::Data(b);
      size_t size=Buffer::Length(b);

      s->push(chunk,size);

      return args.This();
    }

    Handle<Value>
    Stream::End(const Arguments &args){
      
      Stream *s=ObjectWrap::Unwrap<Stream>(args.This());
      if(s->m_state==state_t::open){
        s->close();
      }
      return args.This();
    }

    //---- c->js ----

    void
    Stream::on_data(const char *data, size_t len){
      std::cout << "stream: got <data> event" << std::endl;
      HandleScope scope;

      Buffer *b=Buffer::New(const_cast<char*>(data),len); //make some heat

      Local<Value> argv[1] =
        {Local<Value>::New(b->handle_)};

      MakeCallback(handle_,on_data_sym,1,argv);

    }

    void
    Stream::on_end(){
      std::cout << "stream: got <end> event" << std::endl;
      MakeCallback(handle_,on_end_sym,0,NULL);
    }

    //---- cocaine rpc ----

    void
    Stream::push(const char *chunk, size_t size){
      switch(m_state){
        case state_t::open:
          send<rpc::chunk>(std::string(chunk,size)); //copy
          break;
        case state_t::closed:
          throw cocaine::error_t("the stream has been closed");
      }
    }

    void
    Stream::error(error_code code,
                  const std::string& message) {
      switch(m_state) {
        case state_t::open:
          m_state = state_t::closed;
          send<rpc::error>(static_cast<int>(code), message);
          send<rpc::choke>();
          break;
        case state_t::closed:
          throw cocaine::error_t("the stream has been closed");
      }
    }

    void Stream::close(){
      switch(m_state) {
        case state_t::open:
          m_state = state_t::closed;
          send<rpc::choke>();
          break;
        case state_t::closed:
          throw cocaine::error_t("the stream has been closed");
      }
    }
  
    //----------------
  
    void
    Stream::Initialize(Handle<Object> target){
      s_constructor_ = Persistent<FunctionTemplate>::New(
        FunctionTemplate::New(New));
      s_constructor_->InstanceTemplate()->SetInternalFieldCount(1);
      NODE_SET_PROTOTYPE_METHOD(s_constructor_, "write", Write);
      NODE_SET_PROTOTYPE_METHOD(s_constructor_, "end", End);
    
      target->Set(String::NewSymbol("Stream"),s_constructor_->GetFunction());

      on_data_sym = NODE_PSYMBOL("_on_data");
      on_end_sym = NODE_PSYMBOL("_on_end");
    }
    
  }
} // namespace cocaine::engine


