
#ifndef NOCOCAINE_REQ_HPP
#define NOCOCAINE_REQ_HPP

#include "common.hpp"

namespace cocaine { namespace engine {
    
    class Req {
    public:
      Persistent<Object> object_;
      Stream *stream;
      Req(Stream *s);
        
      virtual
      ~Req();

      void
      callback(int status);

      void
      on_complete();
      
      void
      on_cancel();
      
    };
    
    class ShutdownReq: public Req {
    public:
      ShutdownReq(Stream *s):
        Req(s) {
        //Empty
      }
    };
    
    class WriteReq: public Req {
    public:
      std::string msg;
      size_t length;
      ngx_queue_t m_req_q;
      
      WriteReq(Stream *stream,Handle<Object> buf);
      
    };

  }
} // namespace cocaine::engine



#endif
