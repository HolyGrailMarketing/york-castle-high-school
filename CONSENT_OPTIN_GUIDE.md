# Consent Opt-In Implementation Guide

## ✅ What Has Been Implemented

### 1. **Consent Checkboxes on Forms**

#### **Application Form** (`application-form.html`)
- ✅ **Location**: Before the submit button
- ✅ **Required Consent**: Data processing consent (must be checked to submit)
- ✅ **Optional Consents**: Marketing communications, Third-party sharing
- ✅ **Privacy Policy Link**: Clickable link to open privacy modal
- ✅ **API Integration**: Consents are sent to `/api/consent/record` on form submission

#### **Sixth Form Application** (`sixth-form-application.html`)
- ✅ **Location**: Before the submit button
- ✅ **Required Consent**: Sixth form data processing consent
- ✅ **Optional Consents**: Sixth form marketing, Third-party educational sharing
- ✅ **Privacy Policy Link**: Clickable link to open privacy modal
- ✅ **API Integration**: Consents are sent to `/api/consent/record` on form submission

#### **Contact Form** (`contact-us.html`)
- ✅ **Location**: Before the submit button
- ✅ **Required Consent**: Contact inquiry processing consent
- ✅ **Optional Consents**: Occasional school updates
- ✅ **Privacy Policy Link**: Clickable link to open privacy modal
- ✅ **API Integration**: Consents are sent to `/api/consent/record` on form submission

#### **Request Student Information Form** (`request-student-information.html`)
- ✅ **Location**: Before the submit button
- ✅ **Required Consent**: Student information data processing consent (must confirm legal authority)
- ✅ **Optional Consents**: Data sharing with student/guardian, Follow-up communications
- ✅ **Privacy Policy Link**: Clickable link to open privacy modal
- ✅ **API Integration**: Consents are sent to `/api/consent/record` on form submission
- ✅ **Special Note**: Includes verification notice about legal authority to request information

### 2. **Privacy Policy Modal**

#### **Homepage** (`index.html`)
- ✅ **Privacy Modal**: Added with full content
- ✅ **Trigger**: Click any link with `data_open_privacy="true"` attribute
- ✅ **Close Button**: Click "Close" or click outside modal or press ESC key
- ✅ **Content**: Full privacy policy with Data Subject Rights section

#### **Application Form** (`application-form.html`)
- ✅ **Privacy Modal**: Added with full content
- ✅ **Trigger**: Click "Privacy Policy" link in consent section
- ✅ **Close Button**: Click "Close" or click outside modal or press ESC key
- ✅ **Content**: Full privacy policy with Data Subject Rights section

#### **Sixth Form Application** (`sixth-form-application.html`)
- ✅ **Privacy Modal**: Already existed, now includes consent management section
- ✅ **Consent Management**: Users can view and withdraw consents
- ✅ **API Integration**: `/api/consent/user` to load consents, `/api/consent/:id` to withdraw

#### **Contact Form** (`contact-us.html`)
- ✅ **Privacy Modal**: Already existed
- ✅ **Trigger**: Click "Privacy Policy" link in consent section

## 📍 Where to Find the Consent Sections

### **Application Form**
1. Go to `/application-form.html`
2. Scroll down to the bottom of the form
3. You'll see a **"Data Protection Consent"** section with:
   - A light gray background box
   - Three checkboxes (one required, two optional)
   - A link to "Privacy Policy"
4. The consent section appears **right before the Submit button**

### **Sixth Form Application**
1. Go to `/sixth-form-application.html`
2. Fill out the form
3. Scroll down to before the Submit button
4. You'll see the **"Data Protection Consent"** section with:
   - A light gray background box
   - Three checkboxes (one required, two optional)
   - A link to "Privacy Policy"
5. The consent section appears **right before the Submit button**

### **Contact Form**
1. Go to `/contact-us.html`
2. Fill out the contact form
3. Before the Submit button, you'll see:
   - A **"Data Protection Consent"** section
   - Two checkboxes (one required, one optional)
   - A link to "Privacy Policy"

### **Request Student Information Form**
1. Go to `/request-student-information.html`
2. Fill out the student information request form
3. Before the Submit button, you'll see:
   - A **"Data Protection Consent"** section with light gray background
   - Three checkboxes (one required, two optional)
   - A link to "Privacy Policy"
   - A note about verification and legal authority requirements
4. The consent section appears **right before the Submit button**

## 🔍 How to Test

### **Testing Consent Checkboxes Visibility**
1. Open any form page in your browser
2. Inspect the form (right-click → Inspect)
3. Look for elements with class `consent-section` or `consent-checkbox`
4. Check that they have:
   - `display: block !important`
   - `visibility: visible !important`
   - `opacity: 1 !important`

### **Testing Privacy Modal**
1. Click any link with text "Privacy Policy" (usually in footer or consent section)
2. A modal should appear with:
   - Dark overlay background
   - White dialog box with privacy policy content
   - "Close" button at the bottom
3. Test closing:
   - Click "Close" button
   - Click outside the modal
   - Press ESC key

### **If Consent Sections Are Still Not Visible**

1. **Check Browser Console**:
   - Open Developer Tools (F12)
   - Check for JavaScript errors
   - Check for CSS conflicts

2. **Check if Webflow is Hiding Elements**:
   - Look for CSS rules with `display: none`
   - Check if Webflow form builder is overriding styles
   - Verify elements are inside the `<form>` tag

3. **Force Visibility**:
   - All consent sections now have `!important` flags on visibility CSS
   - Check if parent elements have `display: none` or `visibility: hidden`
   - Verify z-index is high enough (consent sections use `z-index: 1`)

4. **Check Form Structure**:
   - Consent sections should be inside the `<form>` tag
   - They should be before the submit button
   - They should not be inside hidden divs

## 🎨 Styling

### **Consent Section Styling**
- Background: Light gray (`#f9f9f9`)
- Border: 1px solid light gray (`#e5e5e5`)
- Padding: 20px
- Border radius: 8px
- Margin: 20px top and bottom

### **Checkbox Styling**
- Size: 18px × 18px
- Display: Inline-block with `!important`
- Visibility: Always visible with `!important`
- Cursor: Pointer on hover

### **Privacy Modal Styling**
- Overlay: Dark semi-transparent background
- Dialog: White box, max-width 920px, max-height 86vh
- Border radius: 14px
- Shadow: Large drop shadow
- Z-index: 9999

## 🔧 Troubleshooting

### **Issue: Consent sections not showing**
**Solution**: 
- Check browser console for errors
- Verify CSS is loaded
- Check if Webflow form builder is interfering
- Try clearing browser cache

### **Issue: Privacy modal not opening**
**Solution**:
- Check JavaScript console for errors
- Verify `data_open_privacy="true"` attribute is on the link
- Check if privacy modal HTML exists in the page
- Verify JavaScript event listeners are attached

### **Issue: Consents not being recorded**
**Solution**:
- Check Network tab in DevTools for API calls to `/api/consent/record`
- Verify backend API is running
- Check for CORS errors
- Verify email field exists in the form

## 📞 Support

If you're still not seeing the consent sections or privacy modal:
1. Check the browser console for errors
2. Verify the files were saved correctly
3. Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Check if you're viewing the correct files on the correct server
5. Verify the backend server is running and accessible
