
#ifndef NOCOCAINE_REQ_HPP
#define NOCOCAINE_REQ_HPP

#include "common.hpp"

namespace cocaine { namespace engine {

    class Req {
    public:
      Persistent<Object> object_;
      Stream *stream;
      Req(Stream *stream);
        
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
      
    };
    
    class WriteReq: public Req {
    public:
      std::string msg;
      size_t length;
      ngx_queue_t m_req_queue;
      
      WriteReq(Stream *stream,Handle<Object> buf);
      
    };

  }
} // namespace cocaine::engine



#endif
