
#include <nodejs/uv.h>

namespace uv {

  typedef ev_tstamp tstamp;

  enum {
    UNDEF = -1,
    NONE = 0x00,
    READ = 0x01,
    WRITE = 0x02,
    TIMEOUT = 0x00000100,
    PERIODIC = 0x00000200,
    SIGNAL = 0x00000400,
    CHILD = 0x00000800,
    STAT = 0x00001000,
    IDLE = 0x00002000,
    CHECK = 0x00008000,
    PREPARE = 0x00004000,
    FORK = 0x00020000,
    ASYNC = 0x00040000,
    EMBED = 0x00010000,

    ERROR = 0x80000000,
  };

  enum {
    AUTO = 0x00000000U,
    NOENV = 0x01000000U,
    FORKCHECK = 0x02000000U,

    SELECT = 0x00000001U,
    POLL = 0x00000002U,
    EPOLL = 0x00000004U,
    KQUEUE = 0x00000008U,
    DEVPOLL = 0x00000010U,
    PORT = 0x00000020U
  };

  enum {
    NONBLOCK = 1,
    ONESHOT = 2
  };

  enum how_t {
    ONE = 1,
    ALL = 2
  };

  struct bad_loop :
    std::runtime_error {
    
    bad_loop ()
      : std::runtime_error (
          "libev event loop cannot be initialized, "
          "bad value of LIBEV_FLAGS?") {}
  };

  struct loop_ref {
    loop_ref (struct ev_loop *loop) throw ()
      : raw_loop (loop) {}

    bool operator == (const loop_ref &other) const throw () {
      return raw_loop == other.raw_loop;}

    bool operator != (const loop_ref &other) const throw () {
      return ! (*this == other);}

    bool operator == (const struct ev_loop *loop) const throw () {
      return this->raw_loop == loop;}

    bool operator != (const struct ev_loop *loop) const throw () {
      return (*this == loop);}

    operator struct ev_loop * () const throw () {
      return raw_loop;}

    operator const struct ev_loop * () const throw () {
      return raw_loop;}

    bool is_default () const throw () {
      return raw_loop == ev_default_loop (0);}

    void loop (int flags = 0) {
      ev_loop (raw_loop, flags);}

    void unloop (how_t how = ONE) throw () {
      ev_unloop (raw_loop, how);}

    void post_fork () throw () {
      ev_loop_fork (raw_loop);}

    unsigned int backend () const throw () {
      return ev_backend (raw_loop);}

    tstamp now () const throw () {
      return ev_now (raw_loop);}

    void ref () throw () {
      ev_ref (raw_loop);}

    void unref () throw () {
      ev_unref (raw_loop);}

    unsigned int count () const throw () {
      return ev_loop_count (raw_loop);}

    unsigned int depth () const throw () {
      return ev_loop_depth (raw_loop);}

    void set_io_collect_interval (tstamp interval) throw () {
      ev_set_io_collect_interval (raw_loop, interval);}

    void set_timeout_collect_interval (tstamp interval) throw () {
      ev_set_timeout_collect_interval (raw_loop, interval);
    }

    void
    once (int fd, int events, tstamp timeout,
          void (*cb)(int, void *),
          void *arg = 0) throw () {
      ev_once (raw_loop, fd, events, timeout, cb, arg);}

    template<class K, void (K::*method)(int)>
    void
    once (int fd, int events,
          tstamp timeout,
          K *object)
      throw () {
      once (fd, events, timeout,
            method_thunk<K, method>,
            object);}

    template<class K>
    void
    once (int fd, int events,
          tstamp timeout,
          K *object)
      throw () {
      once (fd, events, timeout, method_thunk<K, &K::operator ()>, object);}

    template<class K, void (K::*method)(int)>
    static void
    method_thunk (int revents, void *arg) {
      static_cast<K *>(arg)->*method(revents);}

    template<class K, void (K::*method)()>
    void
    once (int fd, int events,
          tstamp timeout, K *object) throw () {
      once(fd, events, timeout,
           method_noargs_thunk<K, method>,
           object);}

    template<class K, void (K::*method)()>
    static void
    method_noargs_thunk (int revents, void *arg) {
      static_cast<K *>(arg)->*method();}

    template<void (*cb)(int)>
    void
    once (int fd, int events,
          tstamp timeout) throw () {
      once (fd, events, timeout,
            simpler_func_thunk<cb>);}

    template<void (*cb)(int)>
    static void
    simpler_func_thunk (int revents, void *arg) {
      (*cb) (revents);}

    template<void (*cb)()>
    void
    once (int fd, int events, tstamp timeout)
      throw () {
      once (fd, events, timeout, simplest_func_thunk<cb>);}

    template<void (*cb)()>
    static void
    simplest_func_thunk (int revents, void *arg) {
      (*cb) ();}

    void feed_fd_event (int fd, int revents) throw () {
      ev_feed_fd_event (raw_loop, fd, revents);}

    void feed_signal_event (int signum) throw () {
      ev_feed_signal_event (raw_loop, signum);}

    struct ev_loop* raw_loop;

  };

  struct dynamic_loop : loop_ref {
    dynamic_loop (unsigned int flags = AUTO) throw (bad_loop)
      : loop_ref (ev_loop_new (flags)) {
      if (!raw_loop)
        throw bad_loop ();}
    ~dynamic_loop () throw () {
      ev_loop_destroy (raw_loop);
      raw_loop = 0;}
  private:
    dynamic_loop (const dynamic_loop &);
    dynamic_loop & operator= (const dynamic_loop &);};


  struct default_loop : loop_ref {
    default_loop (unsigned int flags = AUTO) throw (bad_loop)
      : loop_ref (ev_default_loop (flags)) {
      if (!raw_loop)
        throw bad_loop ();}
    ~default_loop () throw () {
      ev_default_destroy ();}
  private:
    default_loop (const default_loop &);
    default_loop &operator = (const default_loop &);
  };

  inline loop_ref get_default_loop () throw () {
    return ev_default_loop (0);}

  template<class ev_watcher, class watcher>
  struct base : ev_watcher {
    loop_ref loop;

    void set (struct ev_loop *loop) throw () {
      this->loop = loop;}

    base (loop_ref loop) throw ()
      : loop (loop) {
      do {
        ((ev_watcher *)(this))->active =
          ((ev_watcher *)(this))->pending = NULL;
        ((ev_watcher *)(this))->priority = (0);
        this->cb = NULL;
      } while (0);}

    void set_ (const void *data,
               void (*cb)(struct ev_loop *loop,
                          ev_watcher *w,
                          int revents)) throw () {
      this->data = (void *)data;
      (static_cast<ev_watcher *>(this))->cb = (cb);}

    template<void (*function)(watcher &w, int)>
    void set (void *data = 0) throw () {
      set_ (data, function_thunk<function>);}

    template<void (*function)(watcher &w, int)>
    static void
    function_thunk(struct ev_loop *loop,
                   ev_watcher *w,
                   int revents) {
      function(*static_cast<watcher *>(w), revents);}

    template<class K, void (K::*method)(watcher &w, int)>
    void set (K *object) throw () {
      set_ (object, method_thunk<K, method>);}

    template<class K>
    void set (K *object) throw () {
      set_ (object, method_thunk<K, &K::operator ()>);}

    template<class K, void (K::*method)(watcher &w, int)>
    static void 
    method_thunk (struct ev_loop *loop,
                  ev_watcher *w, int revents) {
      (static_cast<K *>(w->data)->*method)
        (*static_cast<watcher *>(w), revents);}

    template<class K, void (K::*method)()>
    void set (K *object) throw () {
      set_ (object, method_noargs_thunk<K, method>);}

    template<class K, void (K::*method)()>
    static void
    method_noargs_thunk (struct ev_loop *loop,
                         ev_watcher *w,
                         int revents) {
      static_cast<K *>(w->data)->*method();}

    void operator ()(int events = -1) {
      return
        (static_cast<ev_watcher*>(this))->cb(
          static_cast<ev_watcher*>(this), events);}

    bool is_active () const throw () {
      return
        (0 +
          ((ev_watcher *)(void *)
            (static_cast<const ev_watcher *>(this)))->active);}

    bool is_pending () const throw () {
      return
        (0 + ((ev_watcher *)(void *)
              (static_cast<const ev_watcher *>(this)))->pending);}

    void feed_event (int revents) throw () {
        ev_feed_event(
          loop, static_cast<const ev_watcher *>(this),
          revents);}
  };

  inline tstamp now () throw () {
    return ev_time ();}

  inline void delay (tstamp interval) throw () {
    ev_sleep (interval);}

  inline int version_major () throw () {
    return ev_version_major ();}

  inline int version_minor () throw () {
    return ev_version_minor ();}

  inline unsigned int supported_backends () throw () {
    return ev_supported_backends ();}

  inline unsigned int recommended_backends () throw () {
    return ev_recommended_backends ();}

  inline unsigned int embeddable_backends () throw () {
    return ev_embeddable_backends ();}

  inline void
  set_allocator (void *(*cb)(void *ptr,
                             long size)) throw () {
    ev_set_allocator (cb);}

  inline void
  set_syserr_cb (void (*cb)(const char *msg)) throw () {
    ev_set_syserr_cb (cb);}

  struct io : base<ev_io, io> {
    void start () throw () {
      ev_io_start (loop, static_cast<ev_io *>(this));}
    
    void stop () throw () {
      ev_io_stop (loop, static_cast<ev_io *>(this)); }

    io (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_io, io> (loop) { }
    
    ~io () throw () {
      stop (); }

    using base<ev_io, io>::set;
  private:
    io (const io &o);
    io &operator =(const io &o);
  public:
    void set (int fd, int events) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_io *>(this))->fd = (fd);
        (static_cast<ev_io *>(this))->events =
          (events) | EV__IOFDSET;
      } while (0);
      if (active) start ();}

    void set (int events) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_io *>(this))->fd = (fd);
        (static_cast<ev_io *>(this))->events =
          (events) | EV__IOFDSET;
      } while (0);
      if (active) start ();}

    void start (int fd, int events) throw () {
      set (fd, events);
      start ();}
  };

  struct timer : base<ev_timer, timer> {
    void start () throw () {
      ev_timer_start (loop, static_cast<ev_timer *>(this)); }
    
    void stop () throw () {
      ev_timer_stop (loop, static_cast<ev_timer *>(this)); }
    
    timer (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_timer, timer> (loop) { }
    
    ~timer () throw () {
      stop (); }

    using base<ev_timer, timer>::set;
  private:
    timer (const timer &o);
    timer &operator =(const timer &o);
  public:
    void set (ev_tstamp after,
              ev_tstamp repeat = 0.) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        ((ev_watcher_time *)(
          static_cast<ev_timer *>(this)))->at = (after);
        (static_cast<ev_timer *>(this))->repeat = (repeat);
      } while (0);
      if (active) start ();}

    void start (ev_tstamp after,
                ev_tstamp repeat = 0.) throw () {
      set (after, repeat);
      start ();}

    void again () throw () {
      ev_timer_again (loop, static_cast<ev_timer *>(this));}
  };

  struct periodic : base<ev_periodic, periodic> {
    void start () throw () {
      ev_periodic_start (
        loop, static_cast<ev_periodic *>(this)); }
    void stop () throw () {
      ev_periodic_stop (
        loop, static_cast<ev_periodic *>(this)); }
    periodic (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_periodic, periodic> (loop) { }
    ~periodic () throw () {
      stop (); }

    using base<ev_periodic, periodic>::set;
  private:
    periodic (const periodic &o);
    periodic &operator =(const periodic &o);
  public:
    void set (ev_tstamp at, ev_tstamp interval = 0.) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_periodic *>(this))->offset = (at);
        (static_cast<ev_periodic *>(this))->interval = (interval);
        (static_cast<ev_periodic *>(this))->reschedule_cb = (0);
      } while (0);
      if (active) start ();}

    void start (ev_tstamp at, ev_tstamp interval = 0.) throw () {
      set (at, interval);
      start ();}

    void again () throw () {
      ev_periodic_again (loop, static_cast<ev_periodic *>(this));}
  };

  struct sig : base<ev_signal, sig> {
    void start () throw () {
      ev_signal_start (loop, static_cast<ev_signal *>(this)); }
    void stop () throw () {
      ev_signal_stop (loop, static_cast<ev_signal *>(this)); }
    sig (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_signal, sig> (loop) { }
    ~sig () throw () {
      stop (); }
    
    using base<ev_signal, sig>::set;
  private:
    sig (const sig &o);
    sig &operator =(const sig &o);
  public:
    void set (int signum) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_signal *>(this))->signum = (signum);
      } while (0);
      if (active) start ();}

    void start (int signum) throw () {
      set (signum);
      start ();}
  };

  struct child : base<ev_child, child> {
    void start () throw () {
      ev_child_start (loop, static_cast<ev_child *>(this)); }
    void stop () throw () {
      ev_child_stop (loop, static_cast<ev_child *>(this)); }
    child (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_child, child> (loop) { }
    ~child () throw () {
      stop (); }
    
    using base<ev_child, child>::set;
  private:
    child (const child &o);
    child &operator =(const child &o);
  public:
    void set (int pid, int trace = 0) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_child *>(this))->pid = (pid);
        (static_cast<ev_child *>(this))->flags = !!(trace);
      } while (0);
      if (active) start ();}

    void start (int pid, int trace = 0) throw () {
      set (pid, trace);
      start ();}
  };


  struct stat : base<ev_stat, stat> {
    void start () throw () {
      ev_stat_start (loop, static_cast<ev_stat *>(this)); }
    void stop () throw () {
      ev_stat_stop (loop, static_cast<ev_stat *>(this)); }
    stat (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_stat, stat> (loop) { }
    ~stat () throw () {
      stop (); }
    
    using base<ev_stat, stat>::set;
  private:
    stat (const stat &o);
    stat &operator =(const stat &o);
  public:
    void set (const char *path,
              ev_tstamp interval = 0.) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_stat *>(this))->path = (path);
        (static_cast<ev_stat *>(this))->interval = (interval);
        (static_cast<ev_stat *>(this))->wd = -2;
      } while (0);
      if (active) start ();}

    void start (const char *path,
                ev_tstamp interval = 0.) throw () {
      stop ();
      set (path, interval);
      start ();}

    void update () throw () {
      ev_stat_stat (loop, static_cast<ev_stat *>(this));}
  };

  struct idle : base<ev_idle, idle> {
    void start () throw () {
      ev_idle_start (loop, static_cast<ev_idle *>(this)); }
    void stop () throw () {
      ev_idle_stop (loop, static_cast<ev_idle *>(this)); }
    idle (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_idle, idle> (loop) { }
    ~idle () throw () {
      stop (); }
    using base<ev_idle, idle>::set;
  private:
    idle (const idle &o);
    idle &operator =(const idle &o);
  public:
    void set () throw () { }
  };

  struct prepare : base<ev_prepare, prepare> {
    void start () throw () {
      ev_prepare_start (loop, static_cast<ev_prepare *>(this)); }
    void stop () throw () {
      ev_prepare_stop (loop, static_cast<ev_prepare *>(this)); }
    prepare (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_prepare, prepare> (loop) { }
    ~prepare () throw () {
      stop (); }
    using base<ev_prepare, prepare>::set;
  private: 
    prepare (const prepare &o);
    prepare &operator =(const prepare &o);
  public:
    void set () throw () { }
  };

  struct check : base<ev_check, check> {
    void start () throw () {
      ev_check_start (loop, static_cast<ev_check *>(this)); }
    void stop () throw () {
      ev_check_stop (loop, static_cast<ev_check *>(this)); }
    check (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_check, check> (loop) { }
    ~check () throw () {
      stop (); }
    using base<ev_check, check>::set;
  private:
    check (const check &o);
    check &operator =(const check &o);
  public:
    void set () throw () { }
  };

  struct embed : base<ev_embed, embed> {
    void start () throw () {
      ev_embed_start (loop, static_cast<ev_embed *>(this)); }
    void stop () throw () {
      ev_embed_stop (loop, static_cast<ev_embed *>(this)); }
    embed (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_embed, embed> (loop) { }
    ~embed () throw () {
      stop (); }
    using base<ev_embed, embed>::set;
  private:
    embed (const embed &o);
    embed &operator =(const embed &o);
  public:
    void set (struct ev_loop *embedded_loop) throw () {
      int active = is_active ();
      if (active) stop ();
      do {
        (static_cast<ev_embed *>(this))->other =
          (embedded_loop);
      } while (0);
      if (active) start ();}

    void start (struct ev_loop *embedded_loop) throw () {
      set (embedded_loop);
      start ();}

    void sweep () {
      ev_embed_sweep (loop, static_cast<ev_embed *>(this));}
  };

  struct fork : base<ev_fork, fork> {
    void start () throw () {
      ev_fork_start (loop, static_cast<ev_fork *>(this)); }
    void stop () throw () {
      ev_fork_stop (loop, static_cast<ev_fork *>(this)); }
    fork (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_fork, fork> (loop) { }
    ~fork () throw () {
      stop (); }
    using base<ev_fork, fork>::set;
  private:
    fork (const fork &o);
    fork &operator =(const fork &o);
  public:
    void set () throw () { }};

  struct async : base<ev_async, async> {
    void start () throw () {
      ev_async_start (loop, static_cast<ev_async *>(this)); }
    void stop () throw () {
      ev_async_stop (loop, static_cast<ev_async *>(this)); }
    async (loop_ref loop = get_default_loop ()) throw ()
      : base<ev_async, async> (loop) { }
    ~async () throw () {
      stop (); }
    using base<ev_async, async>::set;
  private:
    async (const async &o);
    async &operator =(const async &o);
  public:
    void set () throw () { }
    void send () throw () {
      ev_async_send (loop, static_cast<ev_async *>(this));}
    bool async_pending () throw () {
      return ((static_cast<ev_async *>(this))->sent + 0);}
  };



}







