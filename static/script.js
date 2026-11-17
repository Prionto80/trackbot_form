const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const form = $('#recruitmentForm');
const fullNameInput = $('#full_name');
const studentIdInput = $('#student_id');
const emailInput = $('#email');
const contactNumberInput = $('#contact_number');
const otherRadio = $('#radioOther');
const otherContainer = $('#otherContainer');
const experienceOtherInput = $('#experience_other');
const transactionIdInput = $('#transaction_id');
const screenshotInput = $('#screenshot');
const fileText = $('#fileText');
const filePreview = $('#filePreview');
const previewImg = $('#previewImg');
const removeFileBtn = $('#removeFile');
const submitBtn = $('#submitBtn');
const btnText = $('.btn-text');
const alertBox = $('#alertBox');
const copyBtn = $('#copyBtn');
const copyText = $('#copyText');
const bkashNumber = $('#bkashNumber');

// 1. Toggle "Other" input field for Experience question
$$('input[name="experience"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.value === 'Other') {
      otherContainer.style.display = 'block';
      experienceOtherInput.focus();
    } else {
      otherContainer.style.display = 'none';
      experienceOtherInput.value = '';
    }
  });
});

// 2. Copy bKash Number Helper
copyBtn.addEventListener('click', async () => {
  const number = bkashNumber.textContent.trim();
  try {
    await navigator.clipboard.writeText(number);
    copyText.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyText.textContent = 'Copy';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    // Fallback if clipboard API is not permitted
    const tempInput = document.createElement('input');
    tempInput.value = number;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    copyText.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyText.textContent = 'Copy';
      copyBtn.classList.remove('copied');
    }, 2000);
  }
});

// 3. Handle Image File Selection & Preview
screenshotInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showAlert('Please upload a valid image file (JPG, PNG, WEBP).', 'danger');
    resetFileInput();
    shake();
    return;
  }

  // Max 5MB check
  if (file.size > 5 * 1024 * 1024) {
    showAlert('Image file size must be less than 5MB.', 'danger');
    resetFileInput();
    shake();
    return;
  }

  fileText.textContent = file.name;
  hideAlert();

  const reader = new FileReader();
  reader.onload = (event) => {
    previewImg.src = event.target.result;
    filePreview.style.display = 'flex';
  };
  reader.readAsDataURL(file);
});

// 4. Remove Image Selection
removeFileBtn.addEventListener('click', (e) => {
  e.preventDefault();
  resetFileInput();
});

function resetFileInput() {
  screenshotInput.value = '';
  previewImg.src = '';
  filePreview.style.display = 'none';
  fileText.textContent = 'Add file (JPG, PNG, WEBP)';
}

function showAlert(message, type = 'danger') {
  alertBox.textContent = message;
  alertBox.className = `alert-box ${type}`;
  alertBox.style.display = 'block';
}

function hideAlert() {
  alertBox.style.display = 'none';
  alertBox.textContent = '';
}

function shake() {
  const card = $('.card');
  card.classList.add('shake');
  setTimeout(() => {
    card.classList.remove('shake');
  }, 450);
}

function validateForm() {
  if (!fullNameInput.value.trim()) {
    showAlert('Please enter your Full Name.', 'danger');
    fullNameInput.focus();
    return false;
  }

  if (!studentIdInput.value.trim()) {
    showAlert('Please enter your Student Id.', 'danger');
    studentIdInput.focus();
    return false;
  }

  const emailVal = emailInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailVal)) {
    showAlert('Please enter a valid personal mail address.', 'danger');
    emailInput.focus();
    return false;
  }

  const phoneVal = contactNumberInput.value.trim();
  if (!phoneVal || phoneVal.length < 8) {
    showAlert('Please enter a valid Contact Number.', 'danger');
    contactNumberInput.focus();
    return false;
  }

  const selectedExp = $('input[name="experience"]:checked');
  if (!selectedExp) {
    showAlert('Please select your Previous Experience on Robotics.', 'danger');
    return false;
  }

  if (selectedExp.value === 'Other' && !experienceOtherInput.value.trim()) {
    showAlert('Please specify your previous robotics experience.', 'danger');
    experienceOtherInput.focus();
    return false;
  }

  if (!transactionIdInput.value.trim()) {
    showAlert('Please enter the bKash transaction ID.', 'danger');
    transactionIdInput.focus();
    return false;
  }

  if (!screenshotInput.files || screenshotInput.files.length === 0) {
    showAlert('Please attach your payment proof screenshot.', 'danger');
    return false;
  }

  return true;
}

// 5. Handle Form Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    shake();
    return;
  }

  hideAlert();
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  const formData = new FormData(form);

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok && result.success) {
      submitBtn.classList.remove('loading');
      submitBtn.classList.add('success');
      btnText.textContent = '✓ Registered!';

      showAlert('Application submitted! Redirecting to confirmation page...', 'success');

      // Redirect user to the response page
      const nameVal = (result.data && result.data.full_name) ? result.data.full_name : '';
      const idVal = (result.data && result.data.student_id) ? result.data.student_id : '';
      const trxVal = (result.data && result.data.transaction_id) ? result.data.transaction_id : '';
      const syncVal = (result.data && result.data.google_synced) ? '1' : '0';

      const redirectUrl = `/thank-you?name=${encodeURIComponent(nameVal)}&id=${encodeURIComponent(idVal)}&trx=${encodeURIComponent(trxVal)}&synced=${syncVal}`;

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 900);
    } else {
      throw new Error(result.message || 'Failed to submit application.');
    }
  } catch (error) {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
    showAlert(error.message || 'Network error. Please try again.', 'danger');
    shake();
  }
});
