/*
    Copyright (c) 2013-2013 Oleg Kutkov <olegkutkov@yandex-team.ru>
    Copyright (c) 2013-2013 Other contributors as noted in the AUTHORS file.

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

#include <cocaine/messages.hpp>
#include <cocaine/asio/local.hpp>
#include <cocaine/asio/tcp.hpp>
#include <cocaine/asio/socket.hpp>
#include "nodejs/worker/app_loop.hpp"
#include "nodejs/worker/io/channel.hpp"

#ifndef NODEJS_COCAINE_IO_COMMUNICATOR_HPP
#define NODEJS_COCAINE_IO_COMMUNICATOR_HPP

namespace worker { namespace io {

class error_handler {
public:
	void operator()(const std::error_code& code) {
		throw std::runtime_error(cocaine::format("cocaine_communicator error with code=%d", code));
	}
};

template<class Endpoint_type>
class cocaine_communicator {
	COCAINE_DECLARE_NONCOPYABLE(cocaine_communicator);

public:
	cocaine_communicator(worker::io::app_loop& ioservice
				, const std::string& endpoint_path) {
		auto socket = std::make_shared<cocaine::io::socket<Endpoint_type>>
						(typename Endpoint_type::endpoint(endpoint_path));

		channel.reset(new worker::io::channel<cocaine::io::socket<Endpoint_type>>(ioservice, socket));
		bind_handlers();
	}

	cocaine_communicator(worker::io::app_loop& ioservice
				, const std::string& host
				, const uint16_t port) {
		auto socket = std::make_shared<cocaine::io::socket<Endpoint_type>>
						(typename Endpoint_type::endpoint(host, port));

		channel.reset(new worker::io::channel<cocaine::io::socket<Endpoint_type>>(ioservice, socket));
		bind_handlers();
	}

	~cocaine_communicator() {
		channel->rd->unbind();
		channel->wr->unbind();
	}

	void handshake(const std::string& id) {
		send<cocaine::io::rpc::handshake>(0ul, id);
	}

	void heartbeat() {
		send<cocaine::io::rpc::heartbeat>(0ul);
	}

	void terminate(const int code, const std::string& reason) {
		send<cocaine::io::rpc::terminate>(0ul, static_cast<cocaine::io::rpc::terminate::code>(code), reason);

	}

	void error(const uint64_t s_id, const int code, const std::string& msg) {
		send<cocaine::io::rpc::error>(s_id, cocaine::error_code(code), msg);
		send<cocaine::io::rpc::choke>(s_id);
	}

	void chunk(const uint64_t s_id, const char* data, const size_t size) {
		send<cocaine::io::rpc::chunk>(s_id, std::string(data, size));
	}

	void close(const uint64_t s_id) {
		send<cocaine::io::rpc::choke>(s_id);
	}

	template<class Handler>
	void on_heartbeat(Handler handler) {
		heartbeat_func = handler;
	}

	template<class Handler>
	void on_invoke(Handler handler) {
		invoke_func = handler;
	}

	template<class Handler>
	void on_chunk(Handler handler) {
		chunk_func = handler;
	}

	template<class Handler>
	void on_choke(Handler handler) {
		choke_func = handler;
	}

	template<class Handler>
	void on_error(Handler handler) {
		error_func = handler;
	}

	template<class Handler>
	void on_terminate(Handler handler) {
		terminate_func = handler;
	}

	template<class Event, typename... Args>
	void send(Args&&... args) {
		channel->wr->template write<Event>(std::forward<Args>(args)...);
	}

private:
	void on_message(const cocaine::io::message_t& message) {
		switch(message.id()) {
			case cocaine::io::event_traits<cocaine::io::rpc::heartbeat>::id: {
				heartbeat_func();
				break;
			}

			case cocaine::io::event_traits<cocaine::io::rpc::invoke>::id: {
				std::string event;
				message.as<cocaine::io::rpc::invoke>(event);
				invoke_func(message.band(), event);
				break;
			}

			case cocaine::io::event_traits<cocaine::io::rpc::chunk>::id: {
				std::string chunk;
				message.as<cocaine::io::rpc::chunk>(chunk);
				chunk_func(message.band(), chunk);
				break;
			}

			case cocaine::io::event_traits<cocaine::io::rpc::choke>::id: {
				choke_func(message.band());
				break;
			}

			case cocaine::io::event_traits<cocaine::io::rpc::error>::id: {
				cocaine::error_code ec;
				std::string error_message;
				message.as<cocaine::io::rpc::error>(ec, error_message);
				error_func(message.band(), ec, error_message);
				break;
			}

			case cocaine::io::event_traits<cocaine::io::rpc::terminate>::id: {
				terminate_func();
			}

			default: {
				//skip unknown message
				break;
			}
		}
	}

	void bind_handlers() {
		channel->rd->bind( std::bind(&cocaine_communicator::on_message, this, std::placeholders::_1)
			  		, error_handler() );
		channel->wr->bind(error_handler());
	}

	typedef worker::io::channel<cocaine::io::socket<Endpoint_type>> channel_tpl;
	std::unique_ptr<channel_tpl> channel;

	//event handlers
	std::function<void()> heartbeat_func;
	std::function<void(const uint64_t, const std::string& )> invoke_func;
	std::function<void(const uint64_t, const std::string& )> chunk_func;
	std::function<void(const uint64_t )> choke_func;
	std::function<void(const uint64_t, const int, const std::string& )> error_func; 
	std::function<void()> terminate_func;
};

}} // namespace worker::io

#endif

