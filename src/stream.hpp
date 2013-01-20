


namespace node_worker {

  class Stream;

  class Stream: ObjectWrap {
    enum class state_t: int {
      open, closed};
  
    unique_id  m_id;
    worker_t  *m_worker;
    state_t    m_state;
  
  
  public:
    static void Initialize(Handle<Object> target);

    static
    boost::shared_ptr<Stream>
    New(const unique_id_t& id,
        worker_t * const worker){
      return boost::make_shared<Stream::Shared>(
        new Stream(id,worker));
    }

    //---- js->c api ----
  
    static handle<Value>
    New(const Arguments &args);

    static handle<Value>
    Write(const Arguments &args);

    static handle<Value>
    End(const Arguments &args);

    //---- c->js callbacks ----

    void on_data(char *chunk, size_t len);

    void on_end();

    //----------------
    Stream(const unique_id_t& id,
           worker_t * const worker);

  protected:
  
    virtual void
    push(const char *chunk, size_t size);

    virtual void
    error(error_code code, const std::string &message);

    virtual void
    close();

  private:
    class Shared;

    template<class Event, typename... Args>
    void
    send(Args&&... args){
      m_worker->send<Event>(m_id, std::forward<Args>(args)...);
    }
  
  };

  
  class Stream::Shared {
  private:
    Stream *stream_;
  
  public:

    Shared(Stream *stream){
      assert(stream);
      stream_=stream;
      stream_->Ref();
    };
  
    ~Shared(){
      stream_->Unref();
    }

    reference operator*(){
      BOOST_ASSERT(stream_);
      return *stream_;
    }

    Stream*
    operator->(){
      BOOST_ASSERT(stream_);
      return *stream_;
    }

  };

  void
  Stream::on_data(char *data, size_t len){
    HandleScope scope;
    Local<Value> cb = this->handle_->Get(callback_symbol);
    if(!cb->IsFunction()){
      return;
    }

    Buffer *b=Buffer::New(data,len); //make some heat

    const unsigned argc=1;
    Local<Value> argv[argc] =
      {Local<Value>::New(b->handle_)};

    TryCatch try_catch;
    cb.As<Function>()->Call(this->handle_,1,argv);
    
  }

  
}



int
worker_t::sample () {

  boost::shared_ptr<Stream> stream =
    Stream::New(sid,worker);

  
  
}


