module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-uglify');


  grunt.initConfig({
    uglify: {
      all: {
        files: { 'objectbox.min.js': 'objectbox.js' },
        options: { banner: '// Objectbox.js - https://github.com/thunder9/objectbox.js\n' }
      }
    }
  });


  grunt.registerTask('default', ['uglify']);
};