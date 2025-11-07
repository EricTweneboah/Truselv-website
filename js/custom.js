
  $(function () {

    // MENU
    $('.nav-link').on('click',function(){
      $(".navbar-collapse").collapse('hide');
    });


    // AOS ANIMATION
    AOS.init({
      disable: 'mobile',
      duration: 800,
      anchorPlacement: 'center-bottom'
    });


    // SMOOTH SCROLL (only for in-page anchors)
    $(function() {
      $('.navbar .nav-link[href^="#"]').on('click', function(event) {
        var targetId = $(this).attr('href');
        if (!targetId || targetId === '#') {
          return;
        }

        var $target = $(targetId);
        if (!$target.length) {
          return;
        }

        event.preventDefault();
        $('html, body').stop().animate({
          scrollTop: $target.offset().top
        }, 1000);
      });
    });


    // PROJECT SLIDE
    $('#project-slide').owlCarousel({
      loop: true,
      center: true,
      autoplayHoverPause: false,
      autoplay: true,
      margin: 30,
      responsiveClass:true,
      responsive:{
          0:{
              items:1,
          },
          768:{
              items:2,
          }
      }
    });

  });


    
