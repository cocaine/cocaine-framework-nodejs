

#include "req.hpp"
#include "stream.hpp"

namespace cocaine { namespace engine {

    
    Req::Req(Stream *s){
      HandleScope scope;
      object_ = Persistent<Object>::New(Object::New());
      stream = s;
      Local<Value> domain = Context::GetCurrent()
        ->Global()
        ->Get(process_sym)
        ->ToObject()
        ->Get(domain_sym);
      if(!domain->IsUndefined()){
        object_->Set(domain_sym,domain);
      }
    }
    
    Req::~Req(){
      assert(!object_.IsEmpty());
      object_.Dispose();
      object_.Clear();
    }

    void
    Req::callback(int status){
      HandleScope scope;
      Local<Value> argv[] = {
        Integer::New(status),
        Local<Value>::New(stream->handle_),
        Local<Value>::New(object_)};
      MakeCallback(object_,oncomplete_sym,3,argv);
    }
    
    void
    Req::on_complete(){
      callback(0);
    }
      
    void
    Req::on_cancel(){
      callback(UV_EINTR);
    }
      

    WriteReq::WriteReq(Stream *stream,Handle<Object> buf):
      Req(stream)
    {
      HandleScope scope;
      length = Buffer::Length(buf);
      object_->SetHiddenValue(buffer_sym,buf);
      ngx_queue_init(&m_req_q);
    }


  }
} // namespace cocaine::engine



