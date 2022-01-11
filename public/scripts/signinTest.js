
 'use strict';

 import { initializeApp } from 'firebase/app';
 import {
   getAuth,
   onAuthStateChanged,
   EmailAuthProvider,
   signInWithPopup,
   signOut,
 } from 'firebase/auth';
 import {
   getFirestore,
   collection,
   addDoc,
   query,
   orderBy,
   limit,
   onSnapshot,
   setDoc,
   updateDoc,
   doc,
   serverTimestamp,
 } from 'firebase/firestore';
 import {
   getStorage,
   ref,
   uploadBytesResumable,
   getDownloadURL,
 } from 'firebase/storage';
 import { getMessaging, getToken, onMessage } from 'firebase/messaging';
 import { getPerformance } from 'firebase/performance';
 
 import { getFirebaseConfig } from './firebase-config.js';
 
 async function signIn() {
	if (firebase.auth().currentUser) {
		firebase.auth().signOut();
	} else {
    var provider = new EmailAuthProvider();
    signInWithPopup(getAuth(), provider);
		var email = document.getElementById('email').value;
		var password = document.getElementById('password').value;
		if (email.length < 4) {
			alert('Please enter an email address.');
			return;
		}
		if (password.length < 4) {
			alert('Please enter a password.');
			return;
		}
		// ログイン.
		firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
			// Handle Errors here.
			var errorCode = error.code;
			var errorMessage = error.message;
			if (errorCode === 'auth/wrong-password') {
				alert('Wrong password.');
			} else {
				alert(errorMessage);
			}
			console.log(error);
			document.getElementById('quickstart-sign-in').disabled = false;
		});
	}
	document.getElementById('quickstart-sign-in').disabled = true;
}
 
 // Signs-out of Friendly Chat.
 function signOutUser() {
  firebase.auth().onAuthStateChanged(function(user){
   firebase.auth().signOut(getAuth()).then(()=>{
   location.href = './signin.html';
   signIn();
   });
  });
 }
 
 // Initiate firebase auth
 function initFirebaseAuth() {
   // TODO 3: Subscribe to the user's signed-in status
   // Listen to auth state changes.
   onAuthStateChanged(getAuth(), authStateObserver);
 }
 
 // Returns the signed-in user's profile Pic URL.
 function getProfilePicUrl() {
   // TODO 4: Return the user's profile pic URL.
   return getAuth().currentUser.photoURL || './images/麻雀女子 3.png';
 }
 
 // Returns the signed-in user's display name.
 function getUserName() {
   // TODO 5: Return the user's display name.
   return getAuth().currentUser.displayName;
 }
 
 // Returns true if a user is signed-in.
 function isUserSignedIn() {
   // TODO 6: Return true if a user is signed-in.
   return !!getAuth().currentUser;
 }
 
 // Saves a new message on the Cloud Firestore.
 async function saveMessage(messageText) {
   // TODO 7: Push a new message to Cloud Firestore.
     // Add a new message entry to the Firebase database.
     try {
       await addDoc(collection(getFirestore(), 'messages'), {
         name: getUserName(),
         text: messageText,
         profilePicUrl: getProfilePicUrl(),
         timestamp: serverTimestamp()
       });
     }
     catch(error) {
       console.error('Error writing new message to Firebase Database', error);
     }
 }
 
 // Loads chat messages history and listens for upcoming ones.
 function loadMessages() {
   // TODO 8: Load and listen for new messages.
   // Create the query to load the last 12 messages and listen for new ones.
   const recentMessagesQuery = query(collection(getFirestore(), 'messages'), orderBy('timestamp', 'desc'), limit(12));
   
   // Start listening to the query.
   onSnapshot(recentMessagesQuery, function(snapshot) {
     snapshot.docChanges().forEach(function(change) {
       if (change.type === 'removed') {
         deleteMessage(change.doc.id);
       } else {
         var message = change.doc.data();
         displayMessage(change.doc.id, message.timestamp, message.name,
                       message.text, message.profilePicUrl, message.imageUrl);
       }
     });
   });
 }
 
 // Saves a new message containing an image in Firebase.
 // This first saves the image in Firebase storage.
 async function saveImageMessage(file) {
   // TODO 9: Posts a new image as a message.
   try {
     // 1 - We add a message with a loading icon that will get updated with the shared image.
     const messageRef = await addDoc(collection(getFirestore(), 'messages'), {
       name: getUserName(),
       imageUrl: LOADING_IMAGE_URL,
       profilePicUrl: getProfilePicUrl(),
       timestamp: serverTimestamp()
     });
 
     // 2 - Upload the image to Cloud Storage.
     const filePath = `${getAuth().currentUser.uid}/${messageRef.id}/${file.name}`;
     const newImageRef = ref(getStorage(), filePath);
     const fileSnapshot = await uploadBytesResumable(newImageRef, file);
     
     // 3 - Generate a public URL for the file.
     const publicImageUrl = await getDownloadURL(newImageRef);
 
     // 4 - Update the chat message placeholder with the image's URL.
     await updateDoc(messageRef,{
       imageUrl: publicImageUrl,
       storageUri: fileSnapshot.metadata.fullPath
     });
   } catch (error) {
     console.error('There was an error uploading a file to Cloud Storage:', error);
   }
 }
 
 // Saves the messaging device token to Cloud Firestore.
 async function saveMessagingDeviceToken() {
   // TODO 10: Save the device token in Cloud Firestore
   try {
    const currentToken = await getToken(getMessaging());
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to Cloud Firestore.
      const tokenRef = doc(getFirestore(), 'fcmTokens', currentToken);
      await setDoc(tokenRef, { uid: getAuth().currentUser.uid });

      // This will fire when a message is received while the app is in the foreground.
      // When the app is in the background, firebase-messaging-sw.js will receive the message instead.
      onMessage(getMessaging(), (message) => {
        console.log(
          'New foreground notification from Firebase Messaging!',
          message.notification
        );
      });
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  } catch(error) {
    console.error('Unable to get messaging token.', error);
  };
 }
 
 // Requests permissions to show notifications.
 async function requestNotificationsPermissions() {
   // TODO 11: Request permissions to send notifications.
   console.log('Requesting notifications permission...');
   const permission = await Notification.requestPermission();
   
   if (permission === 'granted') {
     console.log('Notification permission granted.');
     // Notification permission granted.
     await saveMessagingDeviceToken();
   } else {
     console.log('Unable to get permission to notify.');
   }
 }
 
 // Triggered when a file is selected via the media picker.
 function onMediaFileSelected(event) {
   event.preventDefault();
   var file = event.target.files[0];
 
   // Clear the selection in the file picker input.
   imageFormElement.reset();
 
   // Check if the file is an image.
   if (!file.type.match('image.*')) {
     var data = {
       message: 'You can only share images',
       timeout: 2000,
     };
     signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
     return;
   }
   // Check if the user is signed-in
   if (checkSignedInWithMessage()) {
     saveImageMessage(file);
   }
 }
 
 // Triggered when the send new message form is submitted.
 function onMessageFormSubmit(e) {
   e.preventDefault();
   // Check that the user entered a message and is signed in.
   if (messageInputElement.value && checkSignedInWithMessage()) {
     saveMessage(messageInputElement.value).then(function () {
       // Clear message text field and re-enable the SEND button.
       resetMaterialTextfield(messageInputElement);
       toggleButton();
     });
   }
 }
 
 // Triggers when the auth state change for instance when the user signs-in or signs-out.
 function authStateObserver(user) {
   if (user) {
     // User is signed in!
     // Get the signed-in user's profile pic and name.
     var profilePicUrl = getProfilePicUrl();
     var userName = getUserName();
 
     // Set the user's profile pic and name.
     userPicElement.style.backgroundImage =
       'url(' + addSizeToGoogleProfilePic(profilePicUrl) + ')';
     userNameElement.textContent = userName;
 
     // Show user's profile and sign-out button.
     userNameElement.removeAttribute('hidden');
     userPicElement.removeAttribute('hidden');
     signOutButtonElement.removeAttribute('hidden');
 
     // Hide sign-in button.
     signInButtonElement.setAttribute('hidden', 'true');
 
     // We save the Firebase Messaging Device token and enable notifications.
     saveMessagingDeviceToken();
   } else {
     // User is signed out!
     // Hide user's profile and sign-out button.
     userNameElement.setAttribute('hidden', 'true');
     userPicElement.setAttribute('hidden', 'true');
     signOutButtonElement.setAttribute('hidden', 'true');
 
     // Show sign-in button.
     signInButtonElement.removeAttribute('hidden');
   }
 }
 
 // Returns true if user is signed-in. Otherwise false and displays a message.
 function checkSignedInWithMessage() {
   // Return true if the user is signed in Firebase
   if (isUserSignedIn()) {
     return true;
   }
 
   // Display a message to the user using a Toast.
   var data = {
     message: 'You must sign-in first',
     timeout: 2000,
   };
   signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
   return false;
 }
 
 // Resets the given MaterialTextField.
 function resetMaterialTextfield(element) {
   element.value = '';
   element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
 }
 
 // Template for messages.
 var MESSAGE_TEMPLATE =
 '<div class="row justify-content-between border-bottom">' + 
 '<div class="col-8 d-flex justify-content-start">' +
   '<img class="posted-img" src="./images/麻雀女子 3.png" alt="">' +
    '<div class="align-self-start"><p class="name"></p></div>' +
 '</div>' +
 '<div class="col-4 d-flex justify-content-end">' +
   '<div class="date"></div>' +
 '</div>' +
 '<div class="row justify-content-center">' +
   '<div class="col align-self-center">' +
     '<div class="message"></div>' +
   '</div>' +
 '</div>' +
'</div>' 
;
 
 // Adds a size to Google Profile pics URLs.
 function addSizeToGoogleProfilePic(url) {
   if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
     return url + '?sz=150';
   }
   return url;
 }
 
 // A loading image URL.
 var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';
 
 // Delete a Message from the UI.
 function deleteMessage(id) {
   var div = document.getElementById(id);
   // If an element for that message exists we delete it.
   if (div) {
     div.parentNode.removeChild(div);
   }
 }
 
 function createAndInsertMessage(id, timestamp) {
   const container = document.createElement('div');
   container.innerHTML = MESSAGE_TEMPLATE;
   const div = container.firstChild;
   div.setAttribute('id', id);
 
   // If timestamp is null, assume we've gotten a brand new message.
   // https://stackoverflow.com/a/47781432/4816918
   timestamp = timestamp ? timestamp.toMillis() : Date.now();
   div.setAttribute('timestamp', timestamp);
 
   // figure out where to insert new message
   const existingMessages = messageListElement.children;
   if (existingMessages.length === 0) {
     messageListElement.appendChild(div);
   } else {
     let messageListNode = existingMessages[0];
 
     while (messageListNode) {
       const messageListNodeTime = messageListNode.getAttribute('timestamp');
 
       if (!messageListNodeTime) {
         throw new Error(
           `Child ${messageListNode.id} has no 'timestamp' attribute`
         );
       }
 
       if (messageListNodeTime > timestamp) {
         break;
       }
 
       messageListNode = messageListNode.nextSibling;
     }
 
     messageListElement.insertBefore(div, messageListNode);
   }
 
   return div;
 }
 
 // Displays a Message in the UI.
 function displayMessage(id, timestamp, name, text, picUrl, imageUrl) {
   var div =
     document.getElementById(id) || createAndInsertMessage(id, timestamp);
 
   // profile picture
   if (picUrl) {
     div.querySelector('.pic').style.backgroundImage =
       'url(' + addSizeToGoogleProfilePic(picUrl) + ')';
   }
 
   div.querySelector('.name').textContent = name;
   var messageElement = div.querySelector('.message');
 
   if (text) {
     // If the message is text.
     messageElement.textContent = text;
     // Replace all line breaks by <br>.
     messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
   } else if (imageUrl) {
     // If the message is an image.
     var image = document.createElement('img');
     image.addEventListener('load', function () {
       messageListElement.scrollTop = messageListElement.scrollHeight;
     });
     image.src = imageUrl + '&' + new Date().getTime();
     messageElement.innerHTML = '';
     messageElement.appendChild(image);
   }
   // Show the card fading-in and scroll to view the new message.
   setTimeout(function () {
     div.classList.add('visible');
   }, 1);
   messageListElement.scrollTop = messageListElement.scrollHeight;
   messageInputElement.focus();
 }
 
 // Enables or disables the submit button depending on the values of the input
 // fields.
 function toggleButton() {
   if (messageInputElement.value) {
     submitButtonElement.removeAttribute('disabled');
   } else {
     submitButtonElement.setAttribute('disabled', 'true');
   }
 }
 
 // Shortcuts to DOM Elements.
 var messageListElement = document.getElementById('messages');
 var messageFormElement = document.getElementById('message-form');
 var messageInputElement = document.getElementById('message');
 var submitButtonElement = document.getElementById('submit');
 var imageButtonElement = document.getElementById('submitImage');
 var imageFormElement = document.getElementById('image-form');
 var mediaCaptureElement = document.getElementById('mediaCapture');
 var userPicElement = document.getElementById('user-pic');
 var userNameElement = document.getElementById('user-name');
 var signInButtonElement = document.getElementById('sign-in');
 var signOutButtonElement = document.getElementById('sign-out');
 var signInSnackbarElement = document.getElementById('must-signin-snackbar');
 
 // Saves message on form submit.
 messageFormElement.addEventListener('submit', onMessageFormSubmit);
 signOutButtonElement.addEventListener('click', signOutUser);
 signInButtonElement.addEventListener('click', signIn);
 
 // Toggle for the button.
 messageInputElement.addEventListener('keyup', toggleButton);
 messageInputElement.addEventListener('change', toggleButton);
 
 // Events for image upload.
 imageButtonElement.addEventListener('click', function (e) {
   e.preventDefault();
   mediaCaptureElement.click();
 });
 mediaCaptureElement.addEventListener('change', onMediaFileSelected);
 
 // TODO 0: Initialize Firebase
 const firebaseAppConfig = getFirebaseConfig();
 initializeApp(firebaseAppConfig);
 
 // TODO 12: Initialize Firebase Performance Monitoring
 initFirebaseAuth();
 loadMessages();
 // TODO: Enable Firebase Performance Monitoring.
getPerformance();