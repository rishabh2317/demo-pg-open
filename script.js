$(document).ready(function() {

  $('.color-choose input').on('click', function() {
      var headphonesColor = $(this).attr('data-image');

      $('.active').removeClass('active');
      $('.left-column img[data-image = ' + headphonesColor + ']').addClass('active');
      $(this).addClass('active');
  });

});

let user = {
  "amount":"10.00",
  "currency":"INR",
  "mtx":"100091",
  "email_id":"rishabh.thakur@test.com",
  "contact_number":"7349524079"
 };


  async function handleClick(){
  let response1 = await fetch('sandbox-icp-api.bankopen.co/api/payment_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      "Authorization": "Bearer 92a63da0-a0e4-11eb-90c7-8d34bcd27de7:69b4fd96b6c405752c6a4da84a64104fd0b941e3",
    },
    body: JSON.stringify(user)
  });
  alert(response1.id + "Response yahi hai");

  Layer.checkout({
   token: "response1.id",
   accesskey: "92a63da0-a0e4-11eb-90c7-8d34bcd27de7"
   },
   function(response) {
  
   if (response.status == "captured") {
  
   // response.payment_token_id
   // response.payment_id
   } else if (response.status == "created") {
   } else if (response.status == "pending") {
   } else if (response.status == "failed") {
   } else if (response.status == "cancelled") {
   }
   },
   function(err) {
   //integration errors
   }
  );
}
