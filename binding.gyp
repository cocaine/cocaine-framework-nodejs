{
  'targets': [
    {
      'target_name': 'cocaine',
      'sources': [ 'src/main.cpp','src/worker.cpp'],
      'libraries': ['-lcocaine-core -lboost_program_options-mt'],
      'cflags': ['-std=c++0x','-g'],
      'cflags_cc!':['-fno-rtti','-fno-exceptions']
    }
  ]
}

