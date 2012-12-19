
#include <v8.h>
#include <node.h>
#include <zmq.h>
#include <stdlib.h>

using namespace v8;
using namespace node;

namespace {

  class Worker: ObjectWrap {
  public:
    static Handle<Value> New(const Arguments& args);
    static void UV_PollCallback(uv_poll_t* handle, int status, int events);
    static Handle<Value> Message(const Arguments& args) ;
    void Close();
    bool IsReady() ;
  private:
    Worker();
    virtual ~Worker();

    void* context_;
    void* socket_;
    uv_poll_t* poll_handle_;

  };

  Worker::Worker() {
    printf("worker is working...\n");
    context_ = zmq_ctx_new();
    socket_ = zmq_socket(context_,ZMQ_SUB);
    int rc = zmq_connect(socket_, "tcp://localhost:5555");
    assert (rc == 0);

    char *filter = "";//(argc > 1)? argv [1]: "10001 ";
    rc = zmq_setsockopt (socket_, ZMQ_SUBSCRIBE, filter, strlen (filter));
    assert (rc == 0);
    poll_handle_ = new uv_poll_t;
    poll_handle_->data = this;
    
    uv_os_sock_t socket;
    size_t len = sizeof(uv_os_sock_t);
    rc = zmq_getsockopt(socket_, ZMQ_FD, &socket, &len);
    assert(rc == 0);
    
    uv_poll_init_socket(uv_default_loop(), poll_handle_, socket);
    uv_poll_start(poll_handle_, UV_READABLE, Worker::UV_PollCallback);
  }

  Worker::~Worker(){
    Close();
  }

  void
  Worker::Close(){
    zmq_close(socket_);
    zmq_ctx_destroy(context_);
  }

  Handle<Value> Worker::New(const Arguments& args) {
    HandleScope scope;

    assert(args.IsConstructCall());
    Worker* self = new Worker();
    self->Wrap(args.This());

    return scope.Close(args.This());
  }


  Handle<Value> Worker::Message(const Arguments& args) {
    HandleScope scope;

    Handle<Value> argv[2] = {
      String::New("message"), // event name
      args[0]->ToString()  // argument
    };

    MakeCallback(args.This(), "emit", 2, argv);

    return Undefined();
  }
  
  bool
  Worker::IsReady() {
    zmq_pollitem_t items[1];
    items[0].socket = socket_;
    items[0].events = ZMQ_POLLIN;
    return zmq_poll(items, 1, 0);
  }

  void
  Worker::UV_PollCallback(uv_poll_t* handle, int status, int events){
    assert(status == 0);
    Worker* w = static_cast<Worker*>(handle->data);
    //printf("ololo\n");
    while(w->IsReady()){
      //printf("soidfjo\n");
      char *string;
      zmq_msg_t msg;
      zmq_msg_init (&msg);
      int size = zmq_msg_recv(&msg, w->socket_, 0);
      if (size == -1){
        string=NULL;
      } else {
        char *string = static_cast<char*>(malloc(size + 1));
        memcpy (string, zmq_msg_data (&msg), size);
        zmq_msg_close (&msg);
        string [size] = 0;
        //printf(string);
        //printf("\n");
        Handle<Value> argv[2]={
          String::New("message"),
          String::New(string)
        };
        MakeCallback(w->handle_,"emit",2,argv);
      }
        

      //free (string);
      //uv_poll_stop(w->poll_handle_);
      //uv_poll_start(w->poll_handle_, UV_READABLE, Worker::UV_PollCallback);
    }
  }

  extern "C" void init(Handle<Object> target) {
    HandleScope scope;

    Local<FunctionTemplate> t = FunctionTemplate::New(Worker::New);
    t->InstanceTemplate()->SetInternalFieldCount(1);
    t->SetClassName(String::New("Worker"));
    NODE_SET_PROTOTYPE_METHOD(t, "message", Worker::Message);

    target->Set(String::NewSymbol("Worker"), t->GetFunction());
  }

}



