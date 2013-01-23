
#ifndef __NOCOCAINE_STREAM_HPP__
#define __NOCOCAINE_STREAM_HPP__


#include <nodejs/node.h>
#include <nodejs/node_buffer.h>
#include <cocaine/common.hpp>
#include <cocaine/rpc.hpp>
#include <cocaine/unique_id.hpp>
#include <cocaine/context.hpp>
#include <cocaine/logging.hpp>
#include <cocaine/manifest.hpp>
#include <cocaine/profile.hpp>

#include <cocaine/api/sandbox.hpp>

#include <cocaine/traits/unique_id.hpp>
#include <cocaine/traits.hpp>
#include <cocaine/traits/json.hpp>

#include <boost/filesystem/path.hpp>

using namespace cocaine;
using namespace cocaine::engine;
using namespace cocaine::io;
using namespace cocaine::logging;
using namespace v8;
using namespace node;

namespace fs = boost::filesystem;


#if BOOST_VERSION >= 103600
#  define MAP_TYPE boost::unordered_map
#else
#  define MAP_TYPE std::map
#endif

namespace cocaine { namespace engine {

    class worker_t;
    
    class Stream: public ObjectWrap 
    {
      enum class state_t: int {
        open, closed};
  
      unique_id_t  m_id;
      worker_t  *m_worker;
      state_t    m_state;
  
    public:
      static void Initialize(Handle<Object> target);

      class Shared;

      static
      boost::shared_ptr<Stream::Shared>
      MakeShared(const unique_id_t& id,
                 worker_t * const worker);

      static
      Stream*
      New(const unique_id_t& id,
          worker_t *const worker);

      //---- js->c api ----
  
      static Handle<Value>
      New(const Arguments &args);

      static Handle<Value>
      Write(const Arguments &args);

      static Handle<Value>
      End(const Arguments &args);

      //---- c->js callbacks ----

      void on_data(const char *chunk, size_t len);

      void on_end();

      //----------------
      Stream(const unique_id_t& id,
             worker_t * const worker):
        m_id(id),
        m_worker(worker),
        m_state(state_t::open)
        {
          //Empty
        }


      ~Stream();

      virtual void
      push(const char *chunk, size_t size);

      virtual void
      error(error_code code, const std::string &message);

      virtual void
      close();

    private:
      template<class Event, typename... Args>
      void
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

