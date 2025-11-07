<?php
declare(strict_types=1);
mb_internal_encoding('UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

header('Content-Type: text/html; charset=UTF-8');

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));
$honeypot = trim((string) ($_POST['website'] ?? ''));

if ($honeypot !== '') {
    http_response_code(400);
    exit('Bad Request');
}

if ($name === '' || $email === '' || $message === '') {
    http_response_code(422);
    exit('<h2 style="color:red;">Please fill out all required fields.</h2>');
}

if (mb_strlen($message) < 10) {
    http_response_code(422);
    exit('<h2 style="color:red;">Please provide more detail so we can assist you.</h2>');
}

$sanitizedEmail = filter_var($email, FILTER_SANITIZE_EMAIL);
if (!filter_var($sanitizedEmail, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $sanitizedEmail)) {
    http_response_code(422);
    exit('<h2 style="color:red;">Please enter a valid email address.</h2>');
}

$safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
$safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

$to = 'support@truselv.co.uk';
$subject = sprintf('New Contact Form Message from %s', $safeName);

$body = "You have received a new message from your website contact form.\n\n";
$body .= "Name: {$safeName}\n";
$body .= "Email: {$sanitizedEmail}\n";
$body .= "Message:\n{$safeMessage}\n";
$body .= "\nSent on: " . gmdate('Y-m-d H:i:s') . " UTC\n";

$headers = [
    'From: TruSelv Contact <support@truselv.co.uk>',
    'Reply-To: ' . $sanitizedEmail,
    'Content-Type: text/plain; charset=UTF-8',
];

if (mail($to, $subject, $body, implode("\r\n", $headers))) {
    echo "<h2 style='color:green;'>Message sent successfully. Thank you, {$safeName}!</h2>";
} else {
    http_response_code(500);
    echo "<h2 style='color:red;'>Sorry, there was an error sending your message. Please try again later.</h2>";
}
