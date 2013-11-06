/*
    Copyright (c) 2011-2013 Andrey Sibiryov <me@kobology.ru>
    Copyright (c) 2011-2013 Other contributors as noted in the AUTHORS file.

    This file is part of Cocaine.

    Cocaine is free software; you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation; either version 3 of the License, or
    (at your option) any later version.

    Cocaine is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

#ifndef COCAINE_IO_ASYNC_CONNECTOR_HPP
#define COCAINE_IO_ASYNC_CONNECTOR_HPP

#include <cocaine/common.hpp>
#include <uv.h>
#include "nodejs/worker/app_loop.hpp"
#include "nodejs/worker/uv_event.hpp"

#include <cstring>

namespace worker { namespace io {

template<class Socket>
struct async_connector {
    COCAINE_DECLARE_NONCOPYABLE(async_connector)

public:
    typedef Socket socket_type;
    typedef typename socket_type::endpoint_type endpoint_type;

    async_connector(app_loop& loop, endpoint_type endpoint):
        m_endpoint(endpoint),
        m_socket(std::make_shared<socket_type>()),
        m_socket_watcher(new uv_poll_t)
    {
        uv_poll_init(loop.get_loop(), m_socket_watcher, m_socket->fd());
        m_socket_watcher->data = this;
    }

    async_connector(app_loop &loop, const std::shared_ptr<socket_type>& socket):
        m_socket(socket),
        m_socket_watcher(new uv_poll_t)
    {
        uv_poll_init(loop.get_loop(),m_socket_watcher, socket->fd());
        m_socket_watcher->data = this;
    }

    ~async_connector(){
        delete m_socket_watcher;
    }

    template<class ConnectHandler, class ErrorHandler>
    void
    bind(ConnectHandler connect_handler, ErrorHandler error_handler) {
        m_handle_connect = connect_handler;
        m_handle_error = error_handler;
        int r = uv_poll_start(m_socket_watcher, UV_WRITABLE, UvEvent<async_connector>::on_uv_event);
        printf("uv_poll_start result: %d\n",r);
    }

    void
    unbind() {
        uv_poll_stop(m_socket_watcher);
        m_handle_connect = nullptr;
        m_handle_error = nullptr;
    }

    void
    connect(endpoint_type endpoint) {
        std::error_code ec;
        m_socket->connect(endpoint, ec);
        if(ec){
            m_handle_error(ec);
        }
    }

    void on_event(uv_poll_t* req, int status, int event){
        if(status < 0){
            uv_err_t err = uv_last_error(uv_default_loop());
            printf("connect on_event status<0, errno %d\n",err.sys_errno_);
            //handle_error(std::error_code(err.sys_errno_, std::system_category()));
            //uv_poll_stop(socket_watcher);

            if(err.sys_errno_ != EINPROGRESS){
                auto ec = std::error_code(err.sys_errno_, std::system_category());
                m_handle_error(ec);
                return;
            }
            return;
        }

        m_handle_connect();
    }
    
private:
    const std::shared_ptr<socket_type> m_socket;

    endpoint_type m_endpoint;

    // Socket poll object.
    uv_poll_t *m_socket_watcher;

    // Connect done handler.
    std::function<void()>
    m_handle_connect;
    
    // Connect error handler.
    std::function<void(const std::error_code&)>
    m_handle_error;
};

}} // namespace cocaine::io

#endif
