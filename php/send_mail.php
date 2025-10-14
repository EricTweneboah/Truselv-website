<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Sanitize form inputs
    $name = htmlspecialchars(trim($_POST['name']));
    $email = htmlspecialchars(trim($_POST['email']));
    $message = htmlspecialchars(trim($_POST['message']));

    // Your support email
    $to = "support@truselv.co.uk";
    $subject = "New Contact Form Message from $name";

    // Message body
    $body = "You have received a new message from your website contact form.\n\n";
    $body .= "Name: $name\n";
    $body .= "Email: $email\n";
    $body .= "Message:\n$message\n";

    // Email headers
    $headers = "From: $email\r\n";
    $headers .= "Reply-To: $email\r\n";

    // Send the email
    if (mail($to, $subject, $body, $headers)) {
        echo "<h2 style='color:green;'>Message sent successfully. Thank you, $name!</h2>";
    } else {
        echo "<h2 style='color:red;'>Sorry, there was an error sending your message. Please try again later.</h2>";
    }
}
?>
