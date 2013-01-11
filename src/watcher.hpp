


#define EV_CONSTRUCT(cppstem,cstem)                                     \
  (loop_ref loop = get_default_loop ()) throw ()                        \
    : base<ev_ ## cstem, cppstem> (loop)                                \
  {                                                                     \
  }

#define EV_BEGIN_WATCHER(cppstem,cstem)                                 \
                                                                        \
  struct cppstem : base<ev_ ## cstem, cppstem>                          \
                                                                        \
  {                                                                     \
    void start () throw ()                                              \
    {                                                                   \
      ev_ ## cstem ## _start (loop, static_cast<ev_ ## cstem *>(this)); \
    }                                                                   \
                                                                        \
    void stop () throw ()                                               \
    {                                                                   \
      ev_ ## cstem ## _stop (loop, static_cast<ev_ ## cstem *>(this));  \
    }                                                                   \
                                                                        \
    cppstem EV_CONSTRUCT(cppstem,cstem)                                 \
                                                                        \
      ~cppstem () throw ()                                              \
    {                                                                   \
      stop ();                                                          \
    }                                                                   \
                                                                        \
    using base<ev_ ## cstem, cppstem>::set;                             \
                                                                        \
    private:                                                            \
                                                                        \
    cppstem (const cppstem &o);                                         \
                                                                        \
    cppstem &operator =(const cppstem &o);                              \
                                                                        \
    public:                                                             \
  }

#define EV_END_WATCHER(cppstem,cstem)           \
    };
