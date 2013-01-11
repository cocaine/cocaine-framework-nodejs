


{
  void on_event(uv::io&, int);
        
  void on_check(uv::prepare&, int);
        
  void on_heartbeat(uv::timer&, int);

  void on_disown(uv::timer&, int);

  uv::default_loop m_loop;
        
  uv::io m_watcher;
    
  uv::prepare m_checker;
        
  uv::timer m_heartbeat_timer,
    m_disown_timer;


  m_watcher.set<worker_t, &worker_t::on_event>(this);
  m_watcher.start(m_channel.fd(), uv::READ);
  m_checker.set<worker_t, &worker_t::on_check>(this);
  m_checker.start();

  m_heartbeat_timer.set<worker_t, &worker_t::on_heartbeat>(this);
  m_heartbeat_timer.start(0.0f, 5.0f);


  void
    worker_t::on_check(uv::prepare&, int) {
    m_loop.feed_fd_event(m_channel.fd(), ev::READ);
  }

  void
    worker_t::on_heartbeat(uv::timer&, int) {
    scoped_option<
      options::send_timeout
      > option(m_channel, 0);
    
    send<rpc::heartbeat>();
  }

  void
    worker_t::on_disown(uv::timer&, int) {
    COCAINE_LOG_ERROR(
      m_log,
      "worker %s has lost the controlling engine",
      m_id
      );

    m_loop.unloop(uv::ALL);
  }
  

  m_disown_timer.stop();
  m_disown_timer.start(m_profile->heartbeat_timeout);

  m_loop.feed_fd_event(m_channel.fd(), uv::READ);

  m_loop.unloop(uv::ALL);

}





