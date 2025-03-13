import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Image, 
  SafeAreaView,
  Modal,
  FlatList,
  Alert,
  BackHandler
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

const jobCategories = [
  {
    title: "🛠️ Repair and Maintenance",
    tags: [
      "Plumbing",
      "Electrical Repairs",
      "Carpentry",
      "Roof Repair",
      "Painting Services",
      "Welding",
      "Glass Installation",
      "Aircon Repair & Cleaning",
      "Appliance Repair",
      "Pest Control Services"
    ]
  },
  {
    title: "🚗 Vehicle Services",
    tags: [
      "Auto Mechanic",
      "Car Wash",
      "Motorcycle Repair",
      "Car Aircon Repair",
      "Window Tinting"
    ]
  },
  {
    title: "👨‍👩‍👧‍👦 Housekeeping Services",
    tags: [
      "Caregiver",
      "Personal Driver",
      "Massage Therapy",
      "Pet Grooming & Pet Care",
      "Home Cleaning Services",
      "Laundry Services",
      "Gardening"
    ]
  }
];

const allTags = jobCategories.reduce<string[]>((acc, category) => {
  return [...acc, ...category.tags];
}, []);

interface JobData {
  id: string;
  jobTitle: string;
  description: string;
  position: string;
  budget: string;
  location: string;
  imageUri: string | null;
}

const mockJobData: JobData = {
  id: '123',
  jobTitle: 'Fix Leaking Sink',
  description: 'Need an experienced plumber to fix a leaking sink in my bathroom. The issue started last week and is getting worse.',
  position: 'Plumbing',
  budget: '150',
  location: 'Makati City',
  imageUri: null 
};

interface FormState {
  jobTitle: string;
  description: string;
  position: string;
  budget: string;
  location: string;
  image: string | null;
}

export default function EditJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [position, setPosition] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [positionError, setPositionError] = useState(false);
  const [initialFormState, setInitialFormState] = useState<FormState>({
    jobTitle: '',
    description: '',
    position: '',
    budget: '',
    location: '',
    image: null
  });
  
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [showJobUpdatedModal, setShowJobUpdatedModal] = useState(false);

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = () => {
    const jobData = mockJobData;
    
    setJobTitle(jobData.jobTitle);
    setDescription(jobData.description);
    setPosition(jobData.position);
    setBudget(jobData.budget);
    setLocation(jobData.location);
    setImage(jobData.imageUri);
    

    setInitialFormState({
      jobTitle: jobData.jobTitle,
      description: jobData.description,
      position: jobData.position,
      budget: jobData.budget,
      location: jobData.location,
      image: jobData.imageUri
    });
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload images.",
        [{ text: "OK", style: "default" }]
      );
      return false;
    }
    return true;
  };

  const handleGoBack = () => {
    if (unsavedChanges) {
      setShowUnsavedChangesModal(true);
      return true; 
    } else {
      router.back();
      return true;
    }
  };

  useFocusEffect(
    useCallback(() => {
      const currentFormState: FormState = {
        jobTitle,
        description,
        position,
        budget,
        location,
        image
      };
      
      const hasChanges = Object.keys(initialFormState).some(key => {
        const formKey = key as keyof FormState;
        return initialFormState[formKey] !== currentFormState[formKey];
      });
      
      setUnsavedChanges(hasChanges);
      
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (hasChanges) {
            setShowUnsavedChangesModal(true);
            return true; 
          }
          router.back();
          return true;
        }
      );

      return () => backHandler.remove();
    }, [jobTitle, description, position, budget, location, image, initialFormState])
  );

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert(
        "Image Selection Failed",
        "There was a problem selecting your image. Please try again.",
        [{ text: "OK", style: "default" }]
      );
    }
  };

  const removeImage = () => {
    setImage(null);
  };

  const validateForm = () => {
    let isValid = true;
    
    setTitleError(false);
    setPositionError(false);
    
    if (!jobTitle.trim()) {
      setTitleError(true);
      isValid = false;
    }
  
    if (!position) {
      setPositionError(true);
      isValid = false;
    }
    
    return isValid;
  };

  const handleUpdate = () => {
    if (!validateForm()) {
      Alert.alert(
        "Missing Information",
        "Please provide a job title and select a position before updating.",
        [{ text: "OK", style: "default" }],
        { cancelable: true }
      );
      return;
    }
    
    setShowJobUpdatedModal(true);
  };

  const resetFormToInitialState = () => {
    setJobTitle(initialFormState.jobTitle);
    setDescription(initialFormState.description);
    setPosition(initialFormState.position);
    setBudget(initialFormState.budget);
    setLocation(initialFormState.location);
    setImage(initialFormState.image);
    setUnsavedChanges(false);
  };

  const selectTag = (tag: string) => {
    setPosition(tag);
    setPositionError(false);
    setShowTagPicker(false);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleGoBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back-circle-outline" size={36} color="#001F3F" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.title}>Edit job</Text>
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.label}>Job title <Text style={styles.required}>*</Text></Text>
        <TextInput 
          style={[styles.input, titleError && styles.inputError]}
          value={jobTitle}
          onChangeText={(text) => {
            setJobTitle(text);
            if (text.trim()) setTitleError(false);
          }}
          placeholder="Enter job title"
        />
        {titleError && (
          <Text style={styles.errorText}>Job title is required</Text>
        )}
        
        <Text style={styles.label}>Description</Text>
        <TextInput 
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          placeholder="Enter job description"
          multiline
          numberOfLines={4}
        />
        
        <Text style={styles.label}>Position <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity 
          style={[styles.input, positionError && styles.inputError]}
          onPress={() => setShowTagPicker(true)}
        >
          <Text style={position ? styles.inputText : styles.placeholderText}>
            {position || "Select a position"}
          </Text>
        </TouchableOpacity>
        {positionError && (
          <Text style={styles.errorText}>Position is required</Text>
        )}

        <Text style={styles.label}>Budget</Text>
        <TextInput 
          style={styles.input}
          value={budget}
          onChangeText={setBudget}
          placeholder="Enter budget"
          keyboardType="numeric"
        />
        
        <Text style={styles.label}>Location</Text>
        <TextInput 
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Enter location"
        />
        
        <Text style={styles.label}>Add an image</Text>
        <TouchableOpacity 
          style={styles.imageUploadContainer}
          onPress={pickImage}
        >
          {image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.uploadedImage} />
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={removeImage}
              >
                <Ionicons name="close-circle" size={28} color="#001F3F" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="image" size={32} color="#666" />
              <Text style={styles.placeholderText}>Tap to select an image</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.updateButton,
            (!jobTitle.trim() || !position) && styles.updateButtonDisabled
          ]}
          onPress={handleUpdate}
        >
          <Text style={styles.updateButtonText}>Update Job</Text>
        </TouchableOpacity>
        
        <View style={{ height: 30 }} />
      </ScrollView>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTagPicker}
        onRequestClose={() => setShowTagPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Position</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowTagPicker(false)}
              >
                <Ionicons name="close" size={24} color="#001F3F" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={jobCategories}
              keyExtractor={(item) => item.title}
              renderItem={({ item }) => (
                <View>
                  <Text style={styles.categoryTitle}>{item.title}</Text>
                  {item.tags.map((tag) => (
                    <TouchableOpacity 
                      key={tag} 
                      style={[
                        styles.tagItem,
                        position === tag && styles.selectedTagItem
                      ]}
                      onPress={() => selectTag(tag)}
                    >
                      <Text 
                        style={[
                          styles.tagText,
                          position === tag && styles.selectedTagText
                        ]}
                      >
                        {tag}
                      </Text>
                      {position === tag && (
                        <Ionicons name="checkmark-circle" size={24} color="#001F3F" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              style={styles.tagsList}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showUnsavedChangesModal}
        onRequestClose={() => setShowUnsavedChangesModal(false)}
      >
        <View style={styles.successModalContainer}>
          <View style={styles.successModalContent}>
            <View style={styles.warningIconContainer}>
              <MaterialIcons name="warning" size={60} color="#FF9500" />
            </View>
            <Text style={styles.successTitle}>Unsaved Changes</Text>
            <Text style={styles.successMessage}>
              You have unsaved changes that will be lost.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={styles.stayButton}
                onPress={() => setShowUnsavedChangesModal(false)}
              >
                <Text style={styles.stayButtonText}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.discardButton}
                onPress={() => {
                  console.log("Discarding changes...");
                  setShowUnsavedChangesModal(false);
             
                  resetFormToInitialState();
              
                  setTimeout(() => router.back(), 100);
                }}
              >
                <Text style={styles.discardButtonText}>Discard Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showJobUpdatedModal}
        onRequestClose={() => setShowJobUpdatedModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.alertModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            </View>
            <Text style={styles.alertTitle}>Job Updated</Text>
            <Text style={styles.alertMessage}>
              Your job posting has been successfully updated.
            </Text>
            <TouchableOpacity 
              style={styles.successButton}
              onPress={() => {
                setShowJobUpdatedModal(false);
                setInitialFormState({
                  jobTitle,
                  description,
                  position,
                  budget,
                  location,
                  image
                });
                setUnsavedChanges(false);
                router.back();
              }}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: -12,
    marginBottom: 16,
    paddingLeft: 4,
  },
  inputText: {
    color: '#000',
    fontSize: 16,
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  imageUploadContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 24,
    height: 200,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 14,
    padding: 2,
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
  },
  updateButton: {
    backgroundColor: '#001F3F',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  updateButtonDisabled: {
    backgroundColor: '#9AA5B1',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    width: '100%',
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  tagsList: {
    padding: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#001F3F',
  },
  tagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedTagItem: {
    backgroundColor: '#EBF8FF',
  },
  tagText: {
    fontSize: 16,
    color: '#333',
  },
  selectedTagText: {
    color: '#001F3F',
    fontWeight: '500',
  },
  alertModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  warningIconContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  alertButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alertCancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  alertCancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  alertConfirmButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  alertConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successButton: {
    backgroundColor: '#001F3F',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  successModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  stayButton: {
    backgroundColor: '#EEEEEE',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  stayButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  discardButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1.5,
    marginLeft: 8,
    alignItems: 'center',
  },
  discardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});