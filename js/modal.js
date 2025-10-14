  // Fill modal with role when opening
    $('#applyModal').on('show.bs.modal', function (event) {
      var button = $(event.relatedTarget); 
      var job = button.data('job') || 'Application';
      var modal = $(this);
      modal.find('#jobTitle').val(job);
      modal.find('#applyModalLabel').text('Apply — ' + job);
      // Update mailto fallback with selected role
      var mailto = 'mailto:careers@truselv.co.uk?subject=' + encodeURIComponent('Application for ' + job);
      modal.find('#mailtoFallback').attr('href', mailto);
    });

    // Basic client-side submit handler that converts the form to mailto fallback if no backend is configured
    $('#applyForm').on('submit', function(e){
      var action = $(this).attr('action');
      // If action is still placeholder, use mailto fallback
      if(!action || action === '/apply'){
        e.preventDefault();
        var name = $('#appName').val() || '';
        var email = $('#appEmail').val() || '';
        var job = $('#jobTitle').val() || '';
        var message = $('#appCover').val() || '';
        var body = 'Name: ' + name + '%0D%0A' + 'Email: ' + email + '%0D%0A' + '%0D%0A' + encodeURIComponent(message);
        var mailto = 'mailto:careers@truselv.co.uk?subject=' + encodeURIComponent('Application for ' + job) + '&body=' + body;
        window.location.href = mailto;
      }
      // Otherwise the form will submit to the configured backend
    });