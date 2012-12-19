{
  'targets': [
    {
      'target_name': '_cocaine',
      'sources': [ 'src/_cocaine.cc' ],
      'libraries': ['-lzmq'],
      'cflags!': ['-fno-exceptions'],
      'cflags_cc!': ['-fno-exceptions'],
      'conditions': [
        ['OS=="linux"', {
          'cflags': [
            '<!(pkg-config libzmq --cflags 2>/dev/null || echo "")',
          ],
          'libraries': [
            '<!(pkg-config libzmq --libs 2>/dev/null || echo "")',
          ]
        }]
      ]
    }
  ]
}

