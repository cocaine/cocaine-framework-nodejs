

namespace cocaine { namespace engine {

    Persistent<FunctionTemplate> stream_constructor;
    Persistent<FunctionTemplate> worker_constructor;

    Persistent<String> onread_sym;
    Persistent<String> oncomplete_sym;
    Persistent<String> errno_sym;
    Persistent<String> buffer_sym;
    Persistent<String> domain_sym;
    Persistent<String> bytes_sym;
    Persistent<String> write_queue_size_sym;

    void SetErrno(uv_err_t err);

    class nodejs_worker_t;
    class Stream;
    class WriteReq;
    class ShutdownReq;
    
} // namespace cocaine::engine


