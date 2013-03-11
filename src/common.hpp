

namespace cocaine { namespace engine {

    Persistent<FunctionTemplate> s_constructor_;

    Persistent<String> onread_sym;
    Persistent<String> oncomplete_sym;
    Persistent<String> errno_sym;
    Persistent<String> buffer_sym;
    Persistent<String> domain_sym;

    void SetErrno(uv_err_t err);

    class nodejs_worker_t;
    class Stream;
    class WriteReq;
    class ShutdownReq;
    
} // namespace cocaine::engine


