

namespace cocaine { namespace engine {

    Persistent<String> oncomplete_sym;
    
    class Req {
    public:
      Persistent<Object> object_;
      Stream *stream;
      Req(Stream *stream){
        HandleScope scope;
        object_ = Persistent<Object>::New(Object::New());
        stream = stream;
        Local<Value> domain = Context::GetCurrent()
          ->Global()
          ->Get(process_sym)
          ->ToObject()
          ->Get(domain_sym);
        if(!domain->IsUndefined()){
          object_->Set(domain_sym,domain);
        }
      }
      virtual
      ~Req(){
        assert(!object->IsEmpty());
        object_->Dispose();
        object_->Clear();
      }

      void
      callback(int status){
        HandleScope scope;
        Local<Value> argv[] = {
          Integer::New(status),
          Local<Value>::New(stream->handle_),
          Local<Value>::New(object_)};
        MakeCallback(object_,oncomplete_sym,3,argv);
      }

      void
      on_complete(){
        callback(0);
      }
      
      void
      on_cancel(){
        callback(UV_EINTR);
      }
      
    };
    
    class ShutdownReq: public Req {
      
    }
    
    class WriteReq: public Req {
    public:
      std::string msg;
      size_t length;
      ngx_queue_t m_req_queue;
      
      WriteReq(Stream *stream,Handle<Object> buf):
        Req(stream)
        {
          HandleScope scope;
          length = Buffer::Length(buf);
          object_->SetHiddenValue(buffer_sym,buf);
          ngx_queue_init(m_req_queue);
        }
      
      virtual
      ~WriteReq(){
        assert(!object_->IsEmpty());
        object_->Dispose();
        object_->Clear();
      }

    };

  }
} // namespace cocaine::engine


