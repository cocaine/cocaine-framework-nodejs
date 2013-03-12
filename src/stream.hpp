
#ifndef NOCOCAINE_STREAM_HPP
#define NOCOCAINE_STREAM_HPP

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
    public:
      
      static Handle<Value>
      WriteBuffer(const Arguments &args);

      static Handle<Value>
      Shutdown();

      static Handle<Value>
      Close();

      //==== js completion helpers ====
    private:
      void
      AfterWrite(WriteReq *w);
      
      void
      AfterShutdown();

      void
      OnClose();

      void
      OnRead();

      //================

      Stream(const uint64_t &id,
             NodeWorker *const worker);

      ~Stream();

    public:

      static Handle<Value>
      New(const Arguments &args);
      
      static Stream*
      New(const uint64_t& id,
          worker_t *const worker);

      static void
      Initialize(Handle<Object> target);

      //==== loop callbacks ====

      void
      on_shutdown();

      void
      on_stop();
      
      bool
      on_prepare();
      
      bool
      on_try_write1();

      void
      on_data(char *data, size_t size);

      void
      on_end();

      void
      on_error();

      //================
    private:

      boost::shared_ptr<Stream::Shared>
      MakeShared(const uint64_t& id,
                         worker_t * const worker);

      void
      set_want_write(bool want);

      void
      cancel_and_destroy_reqs();

      WriteReq*
      make_write_req(Handle<Object> buf);

      ShutdownReq*
      make_shutdown_req();
      
      template<class Event, typename... Args>
      bool
      send(Args&&... args);
      
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

