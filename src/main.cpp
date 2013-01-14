

#include "worker.hpp"

#include <cocaine/config.hpp>
#include <cocaine/context.hpp>
#include <cocaine/logging.hpp>

#include <iostream>

#include <boost/program_options.hpp>

using namespace cocaine;
using namespace cocaine::engine;
using namespace cocaine::logging;
using namespace v8;

namespace po = boost::program_options;
namespace nodeworker {

  // class Worker: ObjectWrap{
  //   static Handle<Value> New(const Arguments& args);
  //   Worker();
  //   virtual ~Worker();
    
  // }
  
  worker_t *worker;
  std::unique_ptr<context_t> context;

  
  int module_main(int argc, char * argv[]) {
    // int i;
    // for (i = 0; i < argc && i < 256; i++) {
    //   printf("%s\n",argv[i]);
    // }
    po::options_description general_options("General options"),
      slave_options,
      combined_options;
    
    po::variables_map vm;

    general_options.add_options()
      ("help,h", "show this message")
      ("version,v", "show version and build information")
      ("configuration,c", po::value<std::string>
       ()->default_value("/etc/cocaine/cocaine.conf"),
       "location of the configuration file");

    worker_config_t worker_config;

    slave_options.add_options()
      ("app", po::value<std::string>
       (&worker_config.app))
      ("profile", po::value<std::string>
       (&worker_config.profile))
      ("uuid", po::value<std::string>
       (&worker_config.uuid));

    combined_options.add(general_options)
      .add(slave_options);

    try {
      po::store(
        po::command_line_parser(argc, argv).
        options(combined_options).
        run(),
        vm);
      po::notify(vm);
    } catch(const po::unknown_option& e) {
      std::cerr << "Error: " << e.what() << std::endl;
      return EXIT_FAILURE;
    } catch(const po::ambiguous_option& e) {
      std::cerr << "Error: " << e.what() << std::endl;
      return EXIT_FAILURE;
    }

    if(vm.count("help")) {
      std::cout << "Usage: " << argv[0] << " endpoint-list [options]" << std::endl;
      std::cout << general_options << slave_options;
      return EXIT_SUCCESS;
    }

    if(vm.count("version")) {
      std::cout << "Cocaine " << COCAINE_VERSION << std::endl;
      return EXIT_SUCCESS;
    }

    // Validation

    if(!vm.count("configuration")) {
      std::cerr << "Error: no configuration file location has been specified." << std::endl;
      return EXIT_FAILURE;
    }

    // Startup

    try {
      context.reset(new context_t(vm["configuration"].as<std::string>(), "slave"));
    } catch(const std::exception& e) {
      std::cerr << "Error: unable to initialize the context - " << e.what() << std::endl;
      return EXIT_FAILURE;
    }

    //std::unique_ptr<worker_t> worker;

    try {
      worker=new worker_t(
          *context,
          worker_config);
    } catch(const std::exception& e) {
      std::unique_ptr<log_t> log(
        new log_t(*context, "main")
        );
        
      COCAINE_LOG_ERROR(
        log,
        "unable to start the worker - %s",
        e.what());
        
      return EXIT_FAILURE;
    }

    worker->run();

    return 0;
  }

}

const char* ToCString(const v8::String::Utf8Value& value) {
  return *value ? *value : "<string conversion failed>";
}

Handle<Value> RunWorker(const Arguments& args) {
  v8::HandleScope scope1;
  char *argv[256];
  
  int i;
  for (i = 0; i < args.Length() && i < 256; i++) {
    v8::String::Utf8Value str(args[i]);
    argv[i]=strdup(*str);
    //printf("%s\n", argv[i]);
  }
  //printf("\n");

  int rc=nodeworker::module_main(i,argv);
  return scope1.Close(Integer::New(rc));
}

void RegisterModule(Handle<Object> target) {
    target->Set(String::NewSymbol("run"),
        FunctionTemplate::New(RunWorker)->GetFunction());
}

NODE_MODULE(cocaine, RegisterModule);

