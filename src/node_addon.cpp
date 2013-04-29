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

#include "nodejs/worker/worker.hpp"
#include "nodejs/worker/service_resolver.hpp"
#include "nodejs/worker/service_storage.hpp"

using namespace v8;

void InitModule(Handle<Object> exports) {
	worker::services::service_resolver::Initialize(exports);
	worker::services::service_storage::Initialize(exports);
	worker::node_worker::Initialize(exports);
}

NODE_MODULE(nodejs_cocaine_framework, InitModule)

